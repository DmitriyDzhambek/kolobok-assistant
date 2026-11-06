import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export interface DeviceConfig {
  name: string;
  manufacturer: string;
  model: string;
  deviceId: string;
  swVersion: string;
}

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  name: "Наш робот пылесос",
  manufacturer: "TUYA INC",
  model: "iBoto Smart X420GW",
  deviceId: "",
  swVersion: "1.0",
};

const DEVICE_CONFIG_KEY = "kolobok_device_config";

function isDeviceConfig(value: unknown): value is DeviceConfig {
  if (typeof value !== "object" || value === null) return false;
  return ["name", "manufacturer", "model", "deviceId", "swVersion"].every(
    (key) =>
      typeof (value as Record<string, unknown>)[key] === "string",
  );
}

export function useDeviceConfig() {
  const [config, setConfig] = useLocalStorage(
    DEVICE_CONFIG_KEY,
    DEFAULT_DEVICE_CONFIG,
    isDeviceConfig,
  );
  const resetConfig = useCallback(() => setConfig(DEFAULT_DEVICE_CONFIG), [setConfig]);
  return { config, setConfig, resetConfig };
}
