import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Accessibility,
  Battery,
  Bot,
  Home,
  LoaderCircle,
  Power,
  QrCode,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { DeviceConfig } from "../hooks/useDeviceConfig";
import { DeviceSettingsModal } from "./DeviceSettingsModal";
import "./SmartHomeWidget.css";

export type VacuumStatus =
  | "idle"
  | "cleaning"
  | "returning"
  | "charging"
  | "unknown";
type PendingAction = "start" | "stop" | "home" | "status" | null;

const VACUUM_START_LINK = "https://t.me/DzhTrandingbot/app?startapp=start_vacuum";

type SmartHomeWidgetProps = {
  config: DeviceConfig;
  onSaveConfig: (config: DeviceConfig) => void;
  onResetConfig: () => void;
  battery: number | null;
  status: VacuumStatus;
  pendingAction: PendingAction;
  error: string | null;
  onStartCleaning: () => void;
  onSmartClean: () => void;
  onReturnHome: () => void;
  onStopCleaning: () => void;
  onDismissError: () => void;
};

const statusLabels: Record<VacuumStatus, string> = {
  idle: "На базе",
  cleaning: "Убирается…",
  returning: "Едет на зарядку",
  charging: "Заряжается",
  unknown: "Нет данных о состоянии",
};

export function SmartHomeWidget({
  config,
  onSaveConfig,
  onResetConfig,
  battery,
  status,
  pendingAction,
  error,
  onStartCleaning,
  onSmartClean,
  onReturnHome,
  onStopCleaning,
  onDismissError,
}: SmartHomeWidgetProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isLargeButtonMode, setIsLargeButtonMode] = useState(false);
  const roundedBattery = battery === null ? null : Math.round(battery);
  const isLowBattery = roundedBattery !== null && roundedBattery <= 20;
  const isPending = pendingAction !== null;

  useEffect(() => {
    if (!isQrOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsQrOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQrOpen]);

  return (
    <>
      <motion.section
        className={`smart-home-card${isLargeButtonMode ? " has-large-controls" : ""}`}
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
            {roundedBattery === null ? "—" : `${roundedBattery}%`}
          </span>
        </div>
        {roundedBattery !== null && (
          <div
            className="smart-home-battery-track"
            role="progressbar"
            aria-label="Заряд батареи"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={roundedBattery}
          >
            <span style={{ width: `${Math.min(100, Math.max(0, battery ?? 0))}%` }} />
          </div>
        )}
        <p className="smart-home-status-note">
          Статус и заряд загружаются из Tuya Cloud. Проверка выполняется каждые 30 секунд.
        </p>
        {error && (
          <div className="smart-home-command-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              aria-label="Скрыть сообщение об ошибке"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="smart-home-quick-actions">
          <button
            type="button"
            className="smart-home-mode-button"
            aria-pressed={isLargeButtonMode}
            onClick={() => setIsLargeButtonMode((enabled) => !enabled)}
          >
            <Accessibility size={19} aria-hidden="true" />
            {isLargeButtonMode ? "Обычный размер кнопок" : "Крупные кнопки"}
          </button>
          <button
            type="button"
            className="smart-home-qr-button"
            onClick={() => setIsQrOpen(true)}
          >
            <QrCode size={19} aria-hidden="true" />
            Создать QR для быстрого старта
          </button>
        </div>

        <div className="smart-home-controls">
          <button
            type="button"
            className={`smart-home-control${status === "cleaning" ? " is-active" : ""}`}
            onClick={status === "cleaning" ? onStopCleaning : onStartCleaning}
            disabled={isPending}
            aria-label={status === "cleaning" ? "Остановить уборку" : "Запустить уборку"}
          >
            {pendingAction === "start" || pendingAction === "stop" ? (
              <LoaderCircle className="smart-home-spinner" size={19} aria-hidden="true" />
            ) : (
              <Power size={18} aria-hidden="true" />
            )}
            <span>
              {pendingAction === "start"
                ? "Запуск…"
                : pendingAction === "stop"
                  ? "Остановка…"
                  : status === "cleaning"
                    ? "Стоп"
                    : "Старт"}
            </span>
          </button>
          <button
            type="button"
            className="smart-home-control"
            onClick={onReturnHome}
            disabled={
              isPending ||
              status === "returning" ||
              status === "charging" ||
              status === "idle"
            }
            aria-label="Вернуть пылесос на базу"
          >
            {pendingAction === "home" ? (
              <LoaderCircle className="smart-home-spinner" size={19} aria-hidden="true" />
            ) : (
              <Home size={18} aria-hidden="true" />
            )}
            <span>{pendingAction === "home" ? "Отправляю…" : "Домой"}</span>
          </button>
          <motion.button
            type="button"
            className="smart-home-clean-button"
            onClick={onSmartClean}
            whileHover={{ scale: 1.025 }}
            whileTap={{ scale: 0.97 }}
            disabled={status === "cleaning" || isPending}
          >
            {pendingAction === "start" ? (
              <LoaderCircle className="smart-home-spinner" size={19} aria-hidden="true" />
            ) : (
              <Sparkles size={17} aria-hidden="true" />
            )}
            {pendingAction === "start" ? "Запускаю…" : "Уборка с умом"}
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
      <AnimatePresence>
        {isQrOpen && (
          <motion.div
            className="smart-home-modal-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsQrOpen(false);
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className="smart-home-modal smart-home-qr-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="vacuum-qr-title"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
            >
              <button
                type="button"
                className="smart-home-icon-button smart-home-modal-close"
                onClick={() => setIsQrOpen(false)}
                aria-label="Закрыть QR-код"
              >
                <X size={19} />
              </button>
              <h2 id="vacuum-qr-title">Быстрый запуск уборки</h2>
              <div className="smart-home-qr-code">
                <QRCodeSVG
                  value={VACUUM_START_LINK}
                  size={240}
                  level="H"
                  title="QR-код для запуска Колобка в Telegram"
                />
              </div>
              <p className="smart-home-qr-instructions">
                Распечатайте и приклейте на стену. Наведите камеру, чтобы открыть
                Колобка и запустить уборку.
              </p>
              <p className="smart-home-qr-demo-note">
                При открытии в авторизованном Telegram команда отправится пылесосу через Tuya Cloud.
              </p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
