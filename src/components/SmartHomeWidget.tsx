import { useState } from "react";
import { motion } from "framer-motion";
import { Battery, Bot, Home, Power, Settings, Sparkles } from "lucide-react";
import type { DeviceConfig } from "../hooks/useDeviceConfig";
import { DeviceSettingsModal } from "./DeviceSettingsModal";
import "./SmartHomeWidget.css";

export type VacuumStatus = "idle" | "cleaning" | "returning" | "charging";

type SmartHomeWidgetProps = {
  config: DeviceConfig;
  onSaveConfig: (config: DeviceConfig) => void;
  onResetConfig: () => void;
  battery: number;
  status: VacuumStatus;
  onStartCleaning: () => void;
  onSmartClean: () => void;
  onReturnHome: () => void;
  onStopCleaning: () => void;
};

const statusLabels: Record<VacuumStatus, string> = {
  idle: "На базе",
  cleaning: "Убирается…",
  returning: "Едет на зарядку",
  charging: "Заряжается",
};

export function SmartHomeWidget({
  config,
  onSaveConfig,
  onResetConfig,
  battery,
  status,
  onStartCleaning,
  onSmartClean,
  onReturnHome,
  onStopCleaning,
}: SmartHomeWidgetProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const roundedBattery = Math.round(battery);
  const isLowBattery = roundedBattery <= 20;

  return (
    <>
      <motion.section
        className="smart-home-card"
        aria-label="Умный дом"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="smart-home-card-header">
          <div className="smart-home-device-icon" aria-hidden="true">
            <Bot size={23} />
          </div>
          <div className="smart-home-heading">
            <p className="smart-home-eyebrow">КОЛОБОК ДЛЯ ВАШЕГО ДОМА</p>
            <h2>{config.name}</h2>
            <p className="smart-home-device-meta">
              {config.manufacturer} · {config.model} · SW {config.swVersion}
            </p>
          </div>
          <button
            type="button"
            className="smart-home-icon-button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Настроить устройство"
          >
            <Settings size={19} />
          </button>
        </div>

        <div className="smart-home-status-row">
          <div className={`smart-home-status-dot is-${status}`} aria-hidden="true" />
          <span className="smart-home-status">{statusLabels[status]}</span>
          <span className={`smart-home-battery${isLowBattery ? " is-low" : ""}`}>
            <Battery size={17} aria-hidden="true" />
            {roundedBattery}%
          </span>
        </div>
        <div
          className="smart-home-battery-track"
          role="progressbar"
          aria-label="Заряд батареи"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedBattery}
        >
          <span style={{ width: `${Math.min(100, Math.max(0, battery))}%` }} />
        </div>

        <div className="smart-home-controls">
          <button
            type="button"
            className={`smart-home-control${status === "cleaning" ? " is-active" : ""}`}
            onClick={status === "cleaning" ? onStopCleaning : onStartCleaning}
            aria-label={status === "cleaning" ? "Остановить уборку" : "Запустить уборку"}
          >
            <Power size={18} aria-hidden="true" />
            <span>{status === "cleaning" ? "Стоп" : "Старт"}</span>
          </button>
          <button
            type="button"
            className="smart-home-control"
            onClick={onReturnHome}
            disabled={status === "returning" || status === "charging" || status === "idle"}
            aria-label="Вернуть пылесос на базу"
          >
            <Home size={18} aria-hidden="true" />
            <span>Домой</span>
          </button>
          <motion.button
            type="button"
            className="smart-home-clean-button"
            onClick={onSmartClean}
            whileHover={{ scale: 1.025 }}
            whileTap={{ scale: 0.97 }}
            disabled={status === "cleaning"}
          >
            <Sparkles size={17} aria-hidden="true" />
            Уборка с умом
          </motion.button>
        </div>
      </motion.section>
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        config={config}
        onSave={onSaveConfig}
        onReset={onResetConfig}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
