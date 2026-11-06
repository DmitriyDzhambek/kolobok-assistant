import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock3, ExternalLink, Volume2, X } from "lucide-react";
import { tgWebApp } from "../tma";
import type { CryptoCurrency } from "../dreams/storage";

type AutoPilotStep = 1 | 2 | 3;

export interface AutoPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEarningRecorded?: (
    amount: number,
    currency: CryptoCurrency,
  ) => boolean | void;
  projectName?: string;
  telegramLink?: string;
}

export function AutoPilotModal({
  isOpen,
  onClose,
  onEarningRecorded,
  projectName = "Задание",
  telegramLink = "",
}: AutoPilotModalProps) {
  const [step, setStep] = useState<AutoPilotStep>(1);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USDT" | "TON">("USDT");
  const [timeLeft, setTimeLeft] = useState(15);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const [speechError, setSpeechError] = useState("");
  const speechRequestRef = useRef(0);

  useEffect(() => {
    if (!isOpen || step !== 2 || timerEndsAt === null) return;

    const updateTimeLeft = () => {
      setTimeLeft(Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)));
    };
    updateTimeLeft();
    const timer = window.setInterval(updateTimeLeft, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, step, timerEndsAt]);

  const stopSpeaking = useCallback(() => {
    speechRequestRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback((text: string) => {
    const requestId = speechRequestRef.current + 1;
    speechRequestRef.current = requestId;
    setSpeechError("");

    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setSpeechError("Озвучивание не поддерживается этим браузером.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ru-RU";
    utterance.rate = 1;
    utterance.pitch = 1.1;
    utterance.onerror = (event) => {
      if (speechRequestRef.current !== requestId || event.error === "canceled") return;
      console.error("Не удалось озвучить шаг авто-пилота:", event.error);
      setSpeechError("Не удалось включить голос. Проверь настройки звука браузера.");
    };

    window.speechSynthesis.cancel();
    try {
      window.speechSynthesis.speak(utterance);
    } catch (speechFailure) {
      console.error("Не удалось запустить озвучивание авто-пилота:", speechFailure);
      setSpeechError("Не удалось включить голос. Проверь настройки звука браузера.");
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const stepNarration: Record<AutoPilotStep, string> = {
    1: `Привет! Запускаем авто-пилот для проекта ${projectName}. Нажми «Открыть проект», выполни задание в удобном темпе, а затем укажи заработок.`,
    2: "Проект открыт. Выполняй задание в своём темпе. Я запустил таймер-подсказку на 15 секунд — он не ограничивает выполнение.",
    3: "Отличная работа! Укажи сумму заработка и выбери валюту. Запись добавится в баланс сундука желаний.",
  };

  useEffect(() => {
    if (!isOpen) return;
    speak(stepNarration[step]);
    return stopSpeaking;
  }, [isOpen, projectName, speak, step, stopSpeaking]);

  useEffect(() => {
    if (!isOpen || step !== 2 || timerEndsAt === null || timeLeft !== 0) return;
    speak(
      "Время подсказки вышло. Если задание ещё выполняется, продолжай в своём темпе. Когда закончишь, нажми «Я выполнил задание».",
    );
  }, [isOpen, speak, step, timeLeft, timerEndsAt]);

  function handleClose() {
    stopSpeaking();
    onClose();
  }

  const openProject = () => {
    if (!telegramLink) return;
    const telegram = tgWebApp();
    if (telegram?.openTelegramLink) {
      telegram.openTelegramLink(telegramLink);
    } else {
      window.open(telegramLink, "_blank", "noopener,noreferrer");
    }
    setTimeLeft(15);
    setTimerEndsAt(Date.now() + 15_000);
    setStep(2);
  };

  if (!isOpen || typeof document === "undefined") return null;

  const stepText: Record<AutoPilotStep, string> = {
    1: `Открой ${projectName} и ознакомься с заданием. Колобок подождёт здесь.`,
    2:
      timeLeft > 0
        ? `Выполняй задание в своём темпе. Таймер-подсказка: ${timeLeft} сек.`
        : "Время вышло — если уже выполнил задание, продолжай.",
    3: "Укажи сумму, которую заработал. Это поможет вести личный учёт.",
  };

  const advance = () => {
    if (step === 1) openProject();
    else if (step === 2) setStep(3);
    else {
      const earnedAmount = Number(amount);
      if (!Number.isFinite(earnedAmount) || earnedAmount <= 0) return;
      const saved = onEarningRecorded?.(earnedAmount, currency);
      if (saved === false) {
        setSaveError("Не удалось сохранить сумму в сундуке. Попробуй ещё раз.");
        return;
      }
      onClose();
    }
  };
  const validAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="autopilot-overlay"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) handleClose();
        }}
      >
        <motion.section
          className="autopilot-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="autopilot-title"
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="autopilot-close"
            onClick={handleClose}
            aria-label="Закрыть окно"
          >
            <X size={20} />
          </button>

          <div className="autopilot-mark" aria-hidden="true">
            {step === 2 ? <Clock3 size={27} /> : <span>✨</span>}
          </div>
          <p className="autopilot-eyebrow">АВТО-ПИЛОТ · ШАГ {step} ИЗ 3</p>
          <h2 id="autopilot-title">
            {step === 1
              ? "Начинаем?"
              : step === 2
                ? "Колобок ждёт"
                : "Отличная работа!"}
          </h2>
          <div className="autopilot-progress" aria-label={`Шаг ${step} из 3`}>
            {[1, 2, 3].map((number) => (
              <span
                key={number}
                className={number <= step ? "is-complete" : ""}
              />
            ))}
          </div>
          <p className="autopilot-copy" aria-live="polite">{stepText[step]}</p>
          <div className="autopilot-voice-controls">
            <span>Голосовой помощник</span>
            <button
              type="button"
              onClick={() => speak(stepNarration[step])}
              aria-label="Повторить голосовую инструкцию"
            >
              <Volume2 size={16} aria-hidden="true" />
              Повторить
            </button>
          </div>
          {speechError && (
            <p className="autopilot-speech-error" role="status">
              {speechError}
            </p>
          )}

          {step === 3 && (
            <div className="autopilot-amount">
              <span>Сумма заработка для личного учёта</span>
              <div className="autopilot-crypto-fields">
                <label className="autopilot-amount-field">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    aria-label="Сумма заработка"
                  />
                </label>
                <label className="autopilot-currency">
                  <span className="sr-only">Валюта накопления</span>
                  <select
                    value={currency}
                    onChange={(event) =>
                      setCurrency(event.target.value === "TON" ? "TON" : "USDT")
                    }
                  >
                    <option value="USDT">USDT</option>
                    <option value="TON">TON</option>
                  </select>
                </label>
              </div>
              <span className="autopilot-amount-hint">
                Сумма добавится в баланс сундука желаний. Это запись для личного учёта.
              </span>
              {saveError && <span className="autopilot-save-error" role="alert">{saveError}</span>}
            </div>
          )}

          <button
            type="button"
            className="autopilot-action"
            onClick={advance}
            disabled={step === 3 && !validAmount}
          >
            {step === 1 ? (
              <>
                Открыть проект <ExternalLink size={17} />
              </>
            ) : step === 2 ? (
              <>
                Я выполнил задание <Check size={17} />
              </>
            ) : (
              "Готово"
            )}
          </button>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

export default AutoPilotModal;
