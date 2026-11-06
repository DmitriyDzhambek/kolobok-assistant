import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Check, MapPin, Mic, MicOff, RotateCcw, X } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { Kolobok } from "./Kolobok";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import type { CryptoCurrency } from "../dreams/storage";
import "./CryptoSurvival.css";

type CryptoScenario = {
  id: string;
  location: string;
  prompt: string;
  keywords: string[];
  retryPrompt: string;
};

type ScenarioStatus = "idle" | "listening" | "checking" | "success" | "failure";

const SCENARIOS: CryptoScenario[] = [
  {
    id: "dubai-cafe",
    location: "Dubai Cafe",
    prompt:
      "Ты в кафе в Дубае. Попроси принять оплату в USDT по QR-коду и объясни, что официанту нужно его отсканировать.",
    keywords: ["pay", "USDT", "QR code", "scan"],
    retryPrompt:
      "Попробуй ещё раз. Скажи, например: “Can I pay in USDT? Please scan this QR code.”",
  },
  {
    id: "london-hotel",
    location: "London Hotel",
    prompt:
      "Ты приехал в отель в Лондоне. Назови своё имя и скажи, что у тебя есть бронь.",
    keywords: ["check in", "reservation", "name"],
    retryPrompt:
      "Попробуй ещё раз. Используй фразы “check in”, “reservation” и назови своё имя.",
  },
  {
    id: "crypto-conference",
    location: "Crypto Conference",
    prompt:
      "Ты познакомился с партнёром на криптоконференции. Обменяйся контактами и предложи продолжить общение в Telegram.",
    keywords: ["contact", "Telegram", "connect"],
    retryPrompt:
      "Попробуй ещё раз. Предложи обменяться контактами и connect in Telegram.",
  },
];

export function evaluateAnswer(
  text: string,
  keywords: string[],
): { isCorrect: boolean; matchedKeywords: string[] } {
  const normalizedText = text
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const matchedKeywords = keywords.filter((keyword) =>
    normalizedText.includes(
      keyword
        .toLocaleLowerCase("en-US")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  );
  return {
    isCorrect: matchedKeywords.length >= 2,
    matchedKeywords,
  };
}

type CryptoSurvivalProps = {
  isOpen: boolean;
  onClose: () => void;
  onReward: (amount: number, currency: CryptoCurrency) => boolean | void;
};

export function CryptoSurvival({
  isOpen,
  onClose,
  onReward,
}: CryptoSurvivalProps) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [scenarioStatus, setScenarioStatus] = useState<ScenarioStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rewardError, setRewardError] = useState("");
  const [rewardedScenarioIds, setRewardedScenarioIds] = useState<string[]>([]);
  const checkTimerRef = useRef<number | null>(null);
  const scenarioStatusRef = useRef(scenarioStatus);
  const answerHandlerRef = useRef<(answer: string) => void>(() => {});
  scenarioStatusRef.current = scenarioStatus;
  const scenario = SCENARIOS[scenarioIndex];
  const isScenarioRewarded = rewardedScenarioIds.includes(scenario.id);
  const {
    isListening,
    interimText,
    error: voiceError,
    isSupported,
    startRecognition,
    stopRecognition,
    speak,
    setOnTranscript,
  } = useVoiceAssistant({ lang: "en-US" });

  const cleanUpRecognition = useCallback(() => {
    setOnTranscript(null);
    stopRecognition();
  }, [setOnTranscript, stopRecognition]);

  const finishAnswerCheck = useCallback((text: string) => {
    const result = evaluateAnswer(text, scenario.keywords);
    if (!result.isCorrect) {
      setScenarioStatus("failure");
      setFeedback(scenario.retryPrompt);
      void speak(scenario.retryPrompt).catch((speechError: unknown) =>
        console.error("Не удалось озвучить подсказку Crypto Survival:", speechError),
      );
      return;
    }

    if (!isScenarioRewarded) {
      try {
        const saved = onReward(10, "USDT");
        if (saved === false) {
          setRewardError("Не удалось записать награду в демо-баланс. Повтори попытку.");
          setScenarioStatus("failure");
          return;
        }
        setRewardedScenarioIds((current) => [...current, scenario.id]);
      } catch (saveError) {
        console.error("Не удалось сохранить награду Crypto Survival:", saveError);
        setRewardError("Не удалось записать награду в демо-баланс. Повтори попытку.");
        setScenarioStatus("failure");
        return;
      }
    }

    setScenarioStatus("success");
    setFeedback(
      isScenarioRewarded
        ? "Отличный ответ! Эта локация уже пройдена."
        : "Отлично! Ты справился. +10 USDT записаны в учебный демо-баланс.",
    );
    try {
      confetti({
        particleCount: 90,
        spread: 72,
        origin: { y: 0.62 },
        colors: ["#ffd766", "#fbbf24", "#fff3c4", "#f59e0b"],
        disableForReducedMotion: true,
      });
    } catch (confettiError) {
      console.error("Не удалось показать конфетти Crypto Survival:", confettiError);
    }
    void speak(
      isScenarioRewarded
        ? "Отличный ответ! Эта локация уже пройдена."
        : "Отлично! Ты справился. Десять USDT записаны в учебный демо-баланс.",
    ).catch((speechError: unknown) =>
      console.error("Не удалось озвучить результат Crypto Survival:", speechError),
    );
  }, [isScenarioRewarded, onReward, scenario, speak]);

  const handleAnswer = useCallback((answer: string) => {
    const text = answer.trim();
    if (
      !text ||
      scenarioStatusRef.current === "checking" ||
      scenarioStatusRef.current === "success"
    ) return;
    setTranscript(text);
    setTypedAnswer("");
    scenarioStatusRef.current = "checking";
    setScenarioStatus("checking");
    setFeedback("");
    setRewardError("");

    if (checkTimerRef.current !== null) {
      window.clearTimeout(checkTimerRef.current);
    }
    checkTimerRef.current = window.setTimeout(() => {
      checkTimerRef.current = null;
      finishAnswerCheck(text);
    }, 350);
  }, [finishAnswerCheck]);

  answerHandlerRef.current = handleAnswer;

  useEffect(() => {
    if (!isOpen) return;
    setOnTranscript((answer) => answerHandlerRef.current(answer));
    return () => {
      cleanUpRecognition();
      if (checkTimerRef.current !== null) {
        window.clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [cleanUpRecognition, isOpen, setOnTranscript]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      stopRecognition();
      if (checkTimerRef.current !== null) {
        window.clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, [isOpen, onClose, stopRecognition]);

  useEffect(() => {
    if (voiceError && scenarioStatus === "listening") {
      setScenarioStatus("idle");
    }
  }, [scenarioStatus, voiceError]);

  const speakRetryPrompt = () => {
    void speak(feedback || scenario.retryPrompt).catch((speechError: unknown) =>
      console.error("Не удалось повторить подсказку:", speechError),
    );
  };

  const moveToNextScenario = () => {
    stopRecognition();
    scenarioStatusRef.current = "idle";
    setTranscript("");
    setTypedAnswer("");
    setFeedback("");
    setRewardError("");
    setScenarioStatus("idle");
    setScenarioIndex((index) => (index + 1) % SCENARIOS.length);
  };

  const submitTypedAnswer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleAnswer(typedAnswer);
  };

  const statusLabel = useMemo(() => {
    if (isListening || scenarioStatus === "listening") return "Слушаю";
    if (scenarioStatus === "checking") return "Проверяю ответ";
    if (scenarioStatus === "success") return "Отлично!";
    if (scenarioStatus === "failure") return "Попробуй ещё раз";
    return "Готов к ответу";
  }, [isListening, scenarioStatus]);

  if (!isOpen || typeof document === "undefined") return null;

  const dialog = createPortal(
    <AnimatePresence>
      <motion.div
        className="crypto-survival-overlay"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.section
          className="crypto-survival-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crypto-survival-title"
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22 }}
        >
          <button
            type="button"
            className="crypto-survival-close"
            onClick={onClose}
            aria-label="Закрыть крипто-квест"
          >
            <X size={20} />
          </button>

          <header className="crypto-survival-header">
            <span className="crypto-survival-eyebrow">GLOBAL CRYPTO TRAVELER</span>
            <h2 id="crypto-survival-title">Crypto Survival</h2>
            <p>Английский для путешествий и крипто-ситуаций</p>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              className="crypto-survival-scenario"
              key={scenario.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <div className="crypto-survival-location">
                <MapPin size={16} aria-hidden="true" />
                <span>📍 {scenario.location}</span>
                <span>{scenarioIndex + 1} / {SCENARIOS.length}</span>
              </div>

              <div className="crypto-survival-character">
                <Kolobok
                  state={isListening ? "listen" : scenarioStatus === "checking" ? "think" : "idle"}
                  isSleeping={false}
                />
              </div>

              <p className="crypto-survival-prompt">{scenario.prompt}</p>

              <div className={`crypto-survival-status is-${scenarioStatus}`} aria-live="polite">
                {statusLabel}
              </div>

              <button
                type="button"
                className={`crypto-survival-mic${isListening ? " is-listening" : ""}`}
                onClick={() => {
                  if (isListening) stopRecognition();
                  else {
                    setScenarioStatus("listening");
                    setFeedback("");
                    setTranscript("");
                    void startRecognition();
                  }
                }}
                disabled={
                  !isSupported ||
                  scenarioStatus === "success" ||
                  scenarioStatus === "checking"
                }
                aria-label={isListening ? "Остановить запись ответа" : "Записать ответ голосом"}
              >
                {isListening ? <MicOff size={25} /> : <Mic size={25} />}
                <span>{isListening ? "Остановить запись" : "Ответить голосом"}</span>
              </button>

              {!isSupported && (
                <p className="crypto-survival-hint" role="status">
                  Голосовой ввод не поддерживается. Напиши ответ на английском ниже.
                </p>
              )}
              {voiceError && (
                <p className="crypto-survival-error" role="alert">{voiceError}</p>
              )}

              <form className="crypto-survival-text-form" onSubmit={submitTypedAnswer}>
                <label htmlFor="crypto-survival-answer">Или введи ответ на английском</label>
                <div>
                  <input
                    id="crypto-survival-answer"
                    value={typedAnswer}
                    onChange={(event) => setTypedAnswer(event.target.value)}
                    placeholder="Например: Can I pay in USDT?"
                    autoComplete="off"
                    disabled={scenarioStatus === "success" || scenarioStatus === "checking"}
                  />
                  <button
                    type="submit"
                    disabled={
                      !typedAnswer.trim() ||
                      scenarioStatus === "success" ||
                      scenarioStatus === "checking"
                    }
                  >
                    Проверить
                  </button>
                </div>
              </form>

              <div className="crypto-survival-subtitles" aria-live="polite">
                <span>ТВОЙ ОТВЕТ</span>
                <p>{transcript || interimText || "Распознанная речь появится здесь."}</p>
              </div>

              {feedback && (
                <p
                  className={`crypto-survival-feedback is-${scenarioStatus}`}
                  role="status"
                >
                  {feedback}
                </p>
              )}
              {rewardError && (
                <p className="crypto-survival-error" role="alert">{rewardError}</p>
              )}

              <div className="crypto-survival-actions">
                {scenarioStatus === "failure" && (
                  <button type="button" className="crypto-survival-secondary" onClick={speakRetryPrompt}>
                    <RotateCcw size={16} />
                    Повторить подсказку
                  </button>
                )}
                {scenarioStatus === "success" && (
                  <button type="button" className="crypto-survival-next" onClick={moveToNextScenario}>
                    Следующая локация
                    <Check size={17} />
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <ErrorBoundary onGoHome={onClose}>
      {dialog}
    </ErrorBoundary>
  );
}

export default CryptoSurvival;
