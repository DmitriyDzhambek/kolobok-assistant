import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
};

type TuyaEnvelope<T> = {
  success: boolean;
  code?: number | string;
  msg?: string;
  result?: T;
};

type TuyaToken = {
  access_token: string;
  expire_time?: number;
  expires_in?: number;
};

type TuyaStatusItem = {
  code?: string;
  value?: unknown;
};

type VacuumStatus = "idle" | "cleaning" | "returning" | "charging" | "unknown";
type TuyaAction = "start" | "stop" | "home" | "status";

type TuyaConfig = {
  clientId: string;
  clientSecret: string;
  deviceId: string;
  endpoint: string;
};

type CachedToken = {
  value: string;
  expiresAt: number;
  clientId: string;
  clientSecretHash: string;
  endpoint: string;
};

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

class TuyaApiError extends Error {
  constructor(
    readonly code: number | string | undefined,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

let cachedToken: CachedToken | null = null;
let tokenRequest: Promise<string> | null = null;

const allowedTuyaHosts = new Set([
  "openapi.tuyacn.com",
  "openapi.tuyaus.com",
  "openapi-ueaz.tuyaus.com",
  "openapi.tuyaeu.com",
  "openapi-weaz.tuyaeu.com",
  "openapi.tuyain.com",
  "openapi-sg.iotbing.com",
]);

function getTuyaConfig(): TuyaConfig {
  const clientId = process.env.TUYA_CLIENT_ID;
  const clientSecret = process.env.TUYA_CLIENT_SECRET;
  const deviceId = process.env.TUYA_DEVICE_ID;
  const endpoint = process.env.TUYA_ENDPOINT ?? "https://openapi.tuyaeu.com";

  if (!clientId || !clientSecret || !deviceId) {
    throw new HttpError(503, "Tuya Cloud is not configured on the server");
  }

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new HttpError(500, "TUYA_ENDPOINT is not a valid URL");
  }
  if (endpointUrl.protocol !== "https:" || !allowedTuyaHosts.has(endpointUrl.hostname)) {
    throw new HttpError(500, "TUYA_ENDPOINT must be an official Tuya Cloud endpoint");
  }

  return {
    clientId,
    clientSecret,
    deviceId,
    endpoint: endpointUrl.origin,
  };
}

function getHeader(
  headers: VercelRequest["headers"],
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function verifyTelegramInitData(
  initData: string,
  botToken: string,
  allowedUserId: string,
): boolean {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userValue = params.get("user");
  if (!receivedHash || !Number.isFinite(authDate) || !userValue) return false;

  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > 86400) return false;

  let user: { id?: number };
  try {
    user = JSON.parse(userValue) as { id?: number };
  } catch {
    return false;
  }
  if (String(user.id) !== allowedUserId) return false;

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();

  let receivedDigest: Buffer;
  try {
    receivedDigest = Buffer.from(receivedHash, "hex");
  } catch {
    return false;
  }
  return (
    receivedDigest.length === calculatedHash.length &&
    timingSafeEqual(calculatedHash, receivedDigest)
  );
}

function signRequest(
  config: TuyaConfig,
  method: string,
  path: string,
  body: string,
  accessToken?: string,
): { timestamp: string; nonce: string; sign: string } {
  const timestamp = Date.now().toString();
  const nonce = randomUUID();
  const contentHash = createHash("sha256").update(body).digest("hex");
  // Tuya signs the uppercase method, raw-body hash, signed-header section, and exact path/query.
  const stringToSign = `${method}\n${contentHash}\n\n${path}`;
  // Access-token requests omit the token; device requests insert it after client_id.
  const signPayload = `${config.clientId}${accessToken ?? ""}${timestamp}${nonce}${stringToSign}`;
  const sign = createHmac("sha256", config.clientSecret)
    .update(signPayload)
    .digest("hex")
    .toUpperCase();
  return { timestamp, nonce, sign };
}

async function tuyaRequest<T>(
  config: TuyaConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const bodyText = body === undefined ? "" : JSON.stringify(body);
  const { timestamp, nonce, sign } = signRequest(
    config,
    method,
    path,
    bodyText,
    accessToken,
  );
  const headers: Record<string, string> = {
    client_id: config.clientId,
    sign,
    sign_method: "HMAC-SHA256",
    t: timestamp,
    nonce,
  };
  if (accessToken) headers.access_token = accessToken;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${config.endpoint}${path}`, {
      method,
      headers,
      body: bodyText || undefined,
    });
  } catch (error) {
    console.error("Tuya Cloud request failed before receiving a response:", error);
    throw new HttpError(502, "Could not connect to Tuya Cloud");
  }

  let envelope: TuyaEnvelope<T>;
  try {
    envelope = (await response.json()) as TuyaEnvelope<T>;
  } catch {
    console.error("Tuya Cloud returned a non-JSON response", response.status);
    throw new HttpError(502, "Tuya Cloud returned an invalid response");
  }
  if (!response.ok || envelope.success !== true) {
    console.error("Tuya Cloud API error", {
      httpStatus: response.status,
      code: envelope.code,
      message: envelope.msg,
    });
    throw new TuyaApiError(
      envelope.code,
      envelope.msg ?? "Tuya Cloud rejected the request",
      response.status,
    );
  }
  return envelope.result as T;
}

async function getAccessToken(config: TuyaConfig): Promise<string> {
  const clientSecretHash = createHash("sha256")
    .update(config.clientSecret)
    .digest("hex");
  if (
    cachedToken &&
    cachedToken.clientId === config.clientId &&
    cachedToken.clientSecretHash === clientSecretHash &&
    cachedToken.endpoint === config.endpoint &&
    cachedToken.expiresAt > Date.now() + 30_000
  ) {
    return cachedToken.value;
  }
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const result = await tuyaRequest<TuyaToken>(
      config,
      "GET",
      "/v1.0/token?grant_type=1",
    );
    if (!result?.access_token) {
      throw new HttpError(502, "Tuya Cloud did not return an access token");
    }
    const expiresIn = result.expire_time ?? result.expires_in ?? 7200;
    cachedToken = {
      value: result.access_token,
      expiresAt: Date.now() + Math.max(30, expiresIn - 60) * 1000,
      clientId: config.clientId,
      clientSecretHash,
      endpoint: config.endpoint,
    };
    return result.access_token;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

function parseJsonEnv(name: string, defaultValue: unknown): unknown {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new HttpError(500, `${name} must contain a JSON value`);
  }
}

function getCommand(action: Exclude<TuyaAction, "status">): {
  code: string;
  value: unknown;
} {
  if (action === "home") {
    const code = process.env.TUYA_HOME_CODE;
    if (!code) {
      throw new HttpError(
        503,
        "Set TUYA_HOME_CODE to the return-to-dock function code for this device",
      );
    }
    return {
      code,
      value: parseJsonEnv("TUYA_HOME_VALUE", true),
    };
  }

  const startCode = process.env.TUYA_START_CODE ?? "switch_1";
  const stopCode = process.env.TUYA_STOP_CODE ?? startCode;
  const isStart = action === "start";
  return {
    code: isStart ? startCode : stopCode,
    value: parseJsonEnv(
      isStart ? "TUYA_START_VALUE" : "TUYA_STOP_VALUE",
      isStart,
    ),
  };
}

function normalizeStatus(statuses: TuyaStatusItem[]): {
  battery: number | null;
  status: VacuumStatus;
} {
  const batteryEntry = statuses.find((item) =>
    /battery|electricity/i.test(item.code ?? ""),
  );
  const rawBattery =
    typeof batteryEntry?.value === "number"
      ? batteryEntry.value
      : typeof batteryEntry?.value === "string" && batteryEntry.value.trim()
        ? Number(batteryEntry.value)
        : Number.NaN;
  const battery =
    Number.isFinite(rawBattery) && rawBattery >= 0 && rawBattery <= 100
      ? Math.round(rawBattery)
      : null;

  const stateEntry = statuses.find((item) =>
    /work_state|clean_state|cleaning|status|state|mode|switch/i.test(
      item.code ?? "",
    ),
  );
  const state = String(stateEntry?.value ?? "").toLowerCase();
  let status: VacuumStatus = "unknown";
  if (/return|home|dock|recharge/.test(state)) status = "returning";
  else if (/charg/.test(state)) status = "charging";
  else if (/clean|sweep|mop|auto|work/.test(state) || state === "true") {
    status = "cleaning";
  } else if (/idle|standby|pause|stop|false|off/.test(state)) {
    status = "idle";
  }
  return { battery, status };
}

function parseAction(body: unknown): TuyaAction | null {
  const value =
    typeof body === "string"
      ? (() => {
          try {
            return JSON.parse(body) as unknown;
          } catch {
            return null;
          }
        })()
      : body;
  if (!value || typeof value !== "object" || !("action" in value)) return null;
  const action = value.action;
  return action === "start" ||
    action === "stop" ||
    action === "home" ||
    action === "status"
    ? action
    : null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const action = parseAction(req.body);
  if (!action) {
    res.status(400).json({
      ok: false,
      error: "action must be start, stop, home, or status",
    });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const allowedUserId = process.env.TELEGRAM_ALLOWED_USER_ID;
  if (!botToken || !allowedUserId) {
    console.error("Tuya route Telegram authorization is not configured");
    res.status(503).json({
      ok: false,
      error: "Smart-home authorization is not configured on the server",
    });
    return;
  }

  const initData = getHeader(req.headers, "x-tg-init-data");
  if (!initData || !verifyTelegramInitData(initData, botToken, allowedUserId)) {
    res.status(401).json({
      ok: false,
      error: "Open Kolobok from the authorized Telegram account to control this device",
    });
    return;
  }

  try {
    const command = action === "status" ? null : getCommand(action);
    if (command && !/^[A-Za-z0-9_]{1,64}$/.test(command.code)) {
      throw new HttpError(500, "Tuya command code contains invalid characters");
    }

    const config = getTuyaConfig();
    const accessToken = await getAccessToken(config);
    if (action === "status") {
      const deviceId = encodeURIComponent(config.deviceId);
      const statuses = await tuyaRequest<TuyaStatusItem[]>(
        config,
        "GET",
        `/v1.0/devices/${deviceId}/status`,
        undefined,
        accessToken,
      );
      if (!Array.isArray(statuses)) {
        throw new HttpError(502, "Tuya Cloud returned an invalid device status");
      }
      res.status(200).json({ ok: true, ...normalizeStatus(statuses) });
      return;
    }

    if (!command) throw new HttpError(500, "Tuya command configuration is missing");
    await tuyaRequest(
      config,
      "POST",
      `/v1.0/devices/${encodeURIComponent(config.deviceId)}/commands`,
      { commands: [{ code: command.code, value: command.value }] },
      accessToken,
    );
    res.status(200).json({ ok: true, action });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    if (error instanceof TuyaApiError) {
      res.status(502).json({
        ok: false,
        error: "Tuya Cloud rejected the device request. Check the configured device and command codes.",
        code: error.code,
      });
      return;
    }
    console.error("Unexpected Tuya route error:", error);
    res.status(500).json({ ok: false, error: "Unexpected smart-home server error" });
  }
}
