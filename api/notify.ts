declare const process: {
	env: Record<string, string | undefined>;
};

type VercelRequest = {
	method?: string;
	headers: Record<string, string | string[] | undefined>;
	body?: unknown;
};

type VercelResponse = {
	status(code: number): VercelResponse;
	json(body: unknown): void;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer as ArrayBuffer;
}

async function hmacSha256(key: Uint8Array, value: string): Promise<Uint8Array> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		toArrayBuffer(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return new Uint8Array(
		await crypto.subtle.sign(
			"HMAC",
			cryptoKey,
			toArrayBuffer(new TextEncoder().encode(value)),
		),
	);
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let result = 0;
	for (let i = 0; i < left.length; i += 1) {
		result |= left.charCodeAt(i) ^ right.charCodeAt(i);
	}
	return result === 0;
}

async function verifyTelegramInitData(
	initData: string,
	botToken: string,
	allowedUserId: string,
): Promise<boolean> {
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
	const secretKey = await hmacSha256(
		new TextEncoder().encode("WebAppData"),
		botToken,
	);
	const calculatedHash = toHex(await hmacSha256(secretKey, dataCheckString));
	return safeEqual(calculatedHash, receivedHash);
}

export default async function handler(
	req: VercelRequest,
	res: VercelResponse,
): Promise<void> {
	if (req.method !== "POST") {
		res.status(405).json({ error: "Method not allowed" });
		return;
	}

	const botToken = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;
	const allowedUserId = process.env.TELEGRAM_ALLOWED_USER_ID;
	if (!botToken || !chatId || !allowedUserId) {
		console.error("Telegram notification environment is not configured");
		res.status(500).json({ error: "Telegram notifications are not configured" });
		return;
	}

	const initDataHeader = req.headers["x-tg-init-data"];
	const initData = Array.isArray(initDataHeader) ? initDataHeader[0] : initDataHeader;
	if (
		!initData ||
		!(await verifyTelegramInitData(initData, botToken, allowedUserId))
	) {
		res.status(401).json({ error: "Valid Telegram Mini App authentication required" });
		return;
	}

	const body =
		typeof req.body === "string"
			? (() => {
					try {
						return JSON.parse(req.body) as { text?: unknown };
					} catch {
						return null;
					}
				})()
			: req.body;
	if (
		!body ||
		typeof body !== "object" ||
		!("text" in body) ||
		typeof body.text !== "string" ||
		!body.text.trim() ||
		body.text.length > 4096
	) {
		res.status(400).json({ error: "text must be a non-empty string up to 4096 characters" });
		return;
	}

	const telegramResponse = await fetch(
		`https://api.telegram.org/bot${botToken}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, text: body.text.trim() }),
		},
	);
	if (!telegramResponse.ok) {
		console.error("Telegram sendMessage request failed", telegramResponse.status);
		res.status(502).json({ error: "Telegram could not deliver the message" });
		return;
	}
	res.status(200).json({ ok: true });
}
