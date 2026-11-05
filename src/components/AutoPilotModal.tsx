import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock3, ExternalLink, X } from "lucide-react";
import { tgWebApp } from "../tma";

type AutoPilotStep = 1 | 2 | 3;

export interface AutoPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  telegramLink?: string;
}

export function AutoPilotModal({
  isOpen,
  onClose,
  projectName = "Задание",
  telegramLink = "",
}: AutoPilotModalProps) {
  const [step, setStep] = useState<AutoPilotStep>(1);
  const [amount, setAmount] = useState("");
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    if (!isOpen || step !== 2 || timeLeft <= 0) return;
    const timer = window.setTimeout(
      () => setTimeLeft((remaining) => Math.max(remaining - 1, 0)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [isOpen, step, timeLeft]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const openProject = () => {
    if (!telegramLink) return;
    const telegram = tgWebApp();
    if (telegram?.openTelegramLink) {
      telegram.openTelegramLink(telegramLink);
    } else {
      window.open(telegramLink, "_blank", "noopener,noreferrer");
    }
    setTimeLeft(15);
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
    else onClose();
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="autopilot-overlay"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
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
            onClick={onClose}
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
          <p className="autopilot-copy">{stepText[step]}</p>

          {step === 3 && (
            <label className="autopilot-amount">
              <span>Сумма заработка</span>
              <span className="autopilot-amount-field">
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <span>₽</span>
              </span>
            </label>
          )}

          <button
            type="button"
            className="autopilot-action"
            onClick={advance}
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
