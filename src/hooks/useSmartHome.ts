import { useCallback, useEffect, useRef, useState } from "react";
import type { VacuumStatus } from "../components/SmartHomeWidget";
import { tgWebApp } from "../tma";

export type SmartHomeAction = "start" | "stop" | "home" | "status";

type TuyaApiResponse = {
  ok?: boolean;
  error?: string;
  battery?: number | null;
  status?: VacuumStatus;
};

export type SmartHomeSnapshot = {
  battery: number | null;
  status: VacuumStatus;
};

async function requestTuya(action: SmartHomeAction): Promise<TuyaApiResponse> {
  const response = await fetch("/api/tuya", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tg-init-data": tgWebApp()?.initData ?? "",
    },
    body: JSON.stringify({ action }),
  });

  let result: TuyaApiResponse;
  try {
    result = (await response.json()) as TuyaApiResponse;
  } catch {
    throw new Error(
      response.status === 404
        ? "API Tuya не найден. Проверьте конфигурацию серверной функции Vercel."
        : "Сервер управления пылесосом вернул некорректный ответ.",
    );
  }
  if (!response.ok || result.ok !== true) {
    throw new Error(result.error ?? "Не удалось выполнить команду пылесосу.");
  }
  return result;
}

export function useSmartHome() {
  const [battery, setBattery] = useState<number | null>(null);
  const [status, setStatus] = useState<VacuumStatus>("unknown");
  const [pendingAction, setPendingAction] = useState<SmartHomeAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingActionRef = useRef<SmartHomeAction | null>(null);
  const statusRequestRef = useRef<Promise<SmartHomeSnapshot | null> | null>(null);

  const fetchDeviceStatus = useCallback((): Promise<SmartHomeSnapshot | null> => {
    if (statusRequestRef.current) return statusRequestRef.current;
    statusRequestRef.current = (async () => {
      try {
        const result = await requestTuya("status");
        const snapshot: SmartHomeSnapshot = {
          battery:
            typeof result.battery === "number" && Number.isFinite(result.battery)
              ? Math.max(0, Math.min(100, result.battery))
              : null,
          status: result.status ?? "unknown",
        };
        setBattery(snapshot.battery);
        setStatus(snapshot.status);
        setError(null);
        return snapshot;
      } catch (statusError) {
        const message =
          statusError instanceof Error
            ? statusError.message
            : "Не удалось получить состояние пылесоса.";
        console.error("Не удалось обновить состояние пылесоса:", statusError);
        setError(message);
        return null;
      } finally {
        statusRequestRef.current = null;
      }
    })();
    return statusRequestRef.current;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const runAction = useCallback(
    async (action: Exclude<SmartHomeAction, "status">): Promise<boolean> => {
      if (pendingActionRef.current) return false;
      pendingActionRef.current = action;
      setPendingAction(action);
      setError(null);
      try {
        await requestTuya(action);
        void fetchDeviceStatus();
        return true;
      } catch (commandError) {
        const message =
          commandError instanceof Error
            ? commandError.message
            : "Не удалось отправить команду пылесосу.";
        console.error(`Не удалось выполнить команду Tuya (${action}):`, commandError);
        setError(message);
        return false;
      } finally {
        pendingActionRef.current = null;
        setPendingAction(null);
      }
    },
    [fetchDeviceStatus],
  );

  const startRealVacuum = useCallback(
    () => runAction("start"),
    [runAction],
  );
  const stopRealVacuum = useCallback(
    () => runAction("stop"),
    [runAction],
  );
  const returnToBase = useCallback(
    () => runAction("home"),
    [runAction],
  );

  useEffect(() => {
    void fetchDeviceStatus();
    const interval = window.setInterval(() => {
      if (!pendingActionRef.current) void fetchDeviceStatus();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [fetchDeviceStatus]);

  return {
    battery,
    status,
    pendingAction,
    error,
    clearError,
    fetchDeviceStatus,
    startRealVacuum,
    stopRealVacuum,
    returnToBase,
  };
}
