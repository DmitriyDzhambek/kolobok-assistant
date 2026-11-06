import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Copy, RotateCcw, Save, X } from "lucide-react";
import { DEFAULT_DEVICE_CONFIG, type DeviceConfig } from "../hooks/useDeviceConfig";
import "./SmartHomeWidget.css";

const qrFieldNames: Record<keyof DeviceConfig, string[]> = {
  name: ["name", "deviceName", "device_name"],
  manufacturer: ["manufacturer", "brand", "vendor"],
  model: ["model", "productName", "product_name"],
  deviceId: ["deviceId", "device_id", "devId", "dev_id", "device", "uuid", "id"],
  swVersion: ["swVersion", "sw_version", "version", "firmwareVersion"],
};

function getDeviceConfigFromQr(payload: string): Partial<DeviceConfig> | null {
  const parsedFields: Partial<DeviceConfig> = {};
  const assignKnownFields = (source: Record<string, unknown>) => {
    const normalizedSource = Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key.toLowerCase(), value]),
    );
    for (const [configKey, aliases] of Object.entries(qrFieldNames) as Array<
      [keyof DeviceConfig, string[]]
    >) {
      const field = aliases.find(
        (alias) => typeof normalizedSource[alias.toLowerCase()] === "string",
      );
      if (field) {
        const value = (normalizedSource[field.toLowerCase()] as string).trim();
        if (value) parsedFields[configKey] = value;
      }
    }
  };

  try {
    const data: unknown = JSON.parse(payload);
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      assignKnownFields(data as Record<string, unknown>);
      for (const nestedKey of ["device", "data", "payload"]) {
        const nested = (data as Record<string, unknown>)[nestedKey];
        if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
          assignKnownFields(nested as Record<string, unknown>);
        }
      }
    }
  } catch {
    try {
      const url = new URL(payload);
      for (const [key, value] of url.searchParams) {
        assignKnownFields({ [key]: value });
      }
    } catch {
      if (/^[\w.:-]{8,256}$/.test(payload.trim())) {
        parsedFields.deviceId = payload.trim();
      }
    }
  }

  return parsedFields.deviceId ? parsedFields : null;
}

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
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const scanSessionRef = useRef(0);

  const stopScanner = useCallback(() => {
    scanSessionRef.current += 1;
    if (scanFrameRef.current !== null) {
      window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

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
      stopScanner();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [config, isOpen, onClose, stopScanner]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value.trim()]),
    ) as DeviceConfig;
    if (
      [cleaned.name, cleaned.manufacturer, cleaned.model, cleaned.swVersion].some(
        (value) => !value,
      )
    ) {
      setNotice("Заполни имя, производителя, модель и версию устройства.");
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

  const startScanner = async () => {
    setNotice("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice("Камера недоступна. Открой приложение по HTTPS или введи Device ID вручную.");
      return;
    }

    const scanSession = ++scanSessionRef.current;
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      if (scanSessionRef.current !== scanSession) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopScanner();
        setIsScanning(false);
        setNotice("Не удалось открыть окно камеры. Попробуй ввести Device ID вручную.");
        return;
      }
      video.srcObject = stream;
      await video.play();
      const { default: decodeQr } = await import("jsqr");
      if (scanSessionRef.current !== scanSession) return;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        stopScanner();
        setIsScanning(false);
        setNotice("Не удалось запустить сканер. Введи Device ID вручную.");
        return;
      }

      let frameCount = 0;
      const scanFrame = () => {
        if (
          scanSessionRef.current !== scanSession ||
          !video.videoWidth ||
          !video.videoHeight ||
          !streamRef.current
        ) {
          if (scanSessionRef.current === scanSession) {
            scanFrameRef.current = window.requestAnimationFrame(scanFrame);
          }
          return;
        }
        frameCount += 1;
        if (frameCount % 4 !== 0) {
          scanFrameRef.current = window.requestAnimationFrame(scanFrame);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = decodeQr(image.data, image.width, image.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code) {
          const scannedConfig = getDeviceConfigFromQr(code.data);
          stopScanner();
          setIsScanning(false);
          if (!scannedConfig) {
            setNotice("QR-код не содержит Device ID Tuya. Введи ID вручную из приложения Tuya/Smart Life.");
            return;
          }
          setDraft((current) => ({ ...current, ...scannedConfig }));
          setNotice("QR-код распознан. Проверь данные и нажми «Сохранить».");
          return;
        }
        scanFrameRef.current = window.requestAnimationFrame(scanFrame);
      };
      scanFrameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (error) {
      stopScanner();
      setIsScanning(false);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setNotice("Нет доступа к камере. Разреши доступ в браузере или введи Device ID вручную.");
      } else {
        console.error("Не удалось запустить сканер QR:", error);
        setNotice("Не удалось запустить камеру. Проверь её доступность и введи Device ID вручную.");
      }
    }
  };

  const cancelScanner = () => {
    stopScanner();
    setIsScanning(false);
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
          <div className="smart-home-scanner">
            <div className="smart-home-scanner-actions">
              <button
                type="button"
                className="smart-home-copy-id"
                onClick={() => void startScanner()}
                disabled={isScanning}
              >
                <Camera size={16} aria-hidden="true" />
                {isScanning ? "Наведите камеру на QR-код" : "Сканировать QR-код"}
              </button>
              {isScanning && (
                <button
                  type="button"
                  className="smart-home-cancel"
                  onClick={cancelScanner}
                >
                  Остановить камеру
                </button>
              )}
            </div>
            {isScanning && (
              <video
                ref={videoRef}
                className="smart-home-camera"
                muted
                playsInline
                aria-label="Предпросмотр камеры для сканирования QR-кода"
              />
            )}
          </div>
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
                    required={key !== "deviceId"}
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
