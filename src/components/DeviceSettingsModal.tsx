import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, RotateCcw, Save, X } from "lucide-react";
import { DEFAULT_DEVICE_CONFIG, type DeviceConfig } from "../hooks/useDeviceConfig";
import "./SmartHomeWidget.css";

type DeviceSettingsModalProps = {
  isOpen: boolean;
  config: DeviceConfig;
  onSave: (config: DeviceConfig) => void;
  onReset: () => void;
  onClose: () => void;
};

const fields: Array<{ key: keyof DeviceConfig; label: string }> = [
  { key: "name", label: "Имя устройства" },
  { key: "manufacturer", label: "Производитель" },
  { key: "model", label: "Модель" },
  { key: "deviceId", label: "Device ID" },
  { key: "swVersion", label: "SW Version" },
];

export function DeviceSettingsModal({
  isOpen,
  config,
  onSave,
  onReset,
  onClose,
}: DeviceSettingsModalProps) {
  const [draft, setDraft] = useState(config);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setDraft(config);
    setNotice("");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [config, isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value.trim()]),
    ) as DeviceConfig;
    if (Object.values(cleaned).some((value) => !value)) {
      setNotice("Заполни все поля, чтобы сохранить устройство.");
      return;
    }
    onSave(cleaned);
    onClose();
  };

  const copyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(draft.deviceId);
      setNotice("Device ID скопирован.");
    } catch (error) {
      console.error("Не удалось скопировать Device ID:", error);
      setNotice("Не удалось скопировать ID. Выдели и скопируй его вручную.");
    }
  };

  const reset = () => {
    onReset();
    setDraft(DEFAULT_DEVICE_CONFIG);
    setNotice("Настройки Tuya сброшены.");
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="smart-home-modal-overlay"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.section
          className="smart-home-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="device-settings-title"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
        >
          <button
            type="button"
            className="smart-home-icon-button smart-home-modal-close"
            onClick={onClose}
            aria-label="Закрыть настройки"
          >
            <X size={19} />
          </button>
          <p className="smart-home-eyebrow">УМНЫЙ ДОМ · НАСТРОЙКИ</p>
          <h2 id="device-settings-title">Данные устройства</h2>
          <form onSubmit={handleSubmit}>
            <div className="smart-home-form-fields">
              {fields.map(({ key, label }) => (
                <label className="smart-home-field" key={key}>
                  <span>{label}</span>
                  <input
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    autoComplete="off"
                    placeholder={key === "deviceId" ? "Вставь Device ID из Tuya" : undefined}
                    required
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="smart-home-copy-id"
              onClick={() => void copyDeviceId()}
              disabled={!draft.deviceId.trim()}
            >
              <Copy size={15} aria-hidden="true" />
              Скопировать Device ID
            </button>
            {notice && <p className="smart-home-notice" role="status">{notice}</p>}
            <div className="smart-home-modal-actions">
              <button type="button" className="smart-home-reset" onClick={reset}>
                <RotateCcw size={15} aria-hidden="true" />
                Сбросить настройки Tuya
              </button>
              <button type="button" className="smart-home-cancel" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="smart-home-save">
                <Save size={16} aria-hidden="true" />
                Сохранить
              </button>
            </div>
          </form>
          <p className="smart-home-local-note">
            Данные хранятся только в этом браузере. Подключение к Tuya Cloud пока не настроено.
          </p>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
