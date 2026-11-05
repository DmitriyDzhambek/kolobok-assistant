import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Check, Sparkles, Zap, Heart, Loader2 } from "lucide-react";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { IncomeSource } from "./MagicIncome";

/**
 * Шаги автопилота
 */
export type AutoPilotStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Статус таймера
 */
export type TimerStatus = "idle" | "running" | "paused" | "completed";

/**
 * Пропсы компонента
 */
export interface AutoPilotModalProps {
  source: IncomeSource;
  onClose: () => void;
}

/**
 * Описание шагов
 */
const stepDescriptions: Record<AutoPilotStep, { kolobokText: string; userAction?: string; autoSpeak?: boolean }> = {
  1: {
    kolobokText: "Привет! Я беру управление на себя. Я буду говорить тебе, что делать. Сейчас нажми 'Открыть Telegram' и найди там кнопку 'Смотреть рекламу'.",
    autoSpeak: true,
  },
  2: {
    kolobokText: "Отлично! Ты нашел рекламу? Нажми кнопку ниже, когда будет готов.",
    userAction: "Нажми, когда найдешь рекламу",
  },
  3: {
    kolobokText: "Отлично! Реклама пошла. Иди наливай кофе, я буду отсчитывать время. Как только таймер закончится, я скажу тебе вернуться, чтобы закрыть крестик.",
    autoSpeak: true,
  },
  4: {
    kolobokText: "Время вышло! Быстро возвращайся в приложение и закрой рекламу крестиком.",
    autoSpeak: true,
  },
  5: {
    kolobokText: "Отлично! Ты закрыл рекламу? Нажми кнопку ниже, когда будешь готов.",
    userAction: "Нажми, когда закроешь рекламу",
  },
  6: {
    kolobokText: "Супер! Сколько капнуло на баланс? Введи сумму ниже.",
    userAction: "Введи сумму",
  },
  7: {
    kolobokText: "Отлично! Твой баланс пополнен. Молодец! хочешь повторить?",
    autoSpeak: true,
  },
};

/**
 * Эмоции Колобка на каждом шаге
 */
const kolobokEmotions: Record<AutoPilotStep, string> = {
  1: "😊",   // Радуется на старте
  2: "😊",   // Ждет
  3: "🧘",   // Медитирует во время таймера
  4: "😮",   // Удивляется, что время вышло
  5: "😊",   // Радуется
  6: "😃",   // Очень радуется
  7: "🎉",   // Празднует
};

/**
 * Длительность таймера для каждого типа задания (в секундах)
 */
const TIMER_DURATIONS: Record<string, number> = {
  "Реклама": 20,
  "Опрос": 60,
  "Кликер": 30,
  "default": 20,
};

/**
 * Модальное окно Автопилота
 * Пошаговый ассистент с таймером и озвучкой
 */
export function AutoPilotModal({ source, onClose }: AutoPilotModalProps) {
  const [step, setStep] = useState<AutoPilotStep>(1);
  const [timer, setTimer] = useState<number>(0);
  const [timerStatus, setTimerStatus] = useState<TimerStatus>("idle");
  const [inputAmount, setInputAmount] = useState("");
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  const { speak } = useVoiceAssistant();

  // Получаем длительность таймера на основе тегов
  const timerDuration = useCallback(() => {
    const tagMatch = source.tags?.find((tag) => tag in TIMER_DURATIONS);
    return TIMER_DURATIONS[tagMatch || "default"];
  }, [source.tags]);

  // Озвучка текста Колобка
  const speakKolobok = useCallback(async (text: string) => {
    try {
      await speak(text, 1, 1);
    } catch (error) {
      console.error("Ошибка озвучки:", error);
    }
  }, [speak]);

  // Запуск таймера
  const startTimer = useCallback((duration: number) => {
    setTimer(duration);
    setTimerStatus("running");
  }, []);

  // Обработка тика таймера
  useEffect(() => {
    if (timerStatus === "running" && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimerStatus("completed");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, timerStatus]);

  // Автоматическая озвучка на определенных шагах
  useEffect(() => {
    const currentStep = stepDescriptions[step];
    if (currentStep.autoSpeak) {
      speakKolobok(currentStep.kolobokText);
    }
  }, [step, speakKolobok]);

  // Автоматический переход после таймера
  useEffect(() => {
    if (timerStatus === "completed" && step === 3) {
      setTimeout(() => {
        setStep(4);
      }, 1000);
    }
  }, [timerStatus, step]);

  // Действия по шагам
  const handleNextStep = () => {
    switch (step) {
      case 1:
        // Открыть Telegram
        setIsTelegramOpen(true);
        setStep(2);
        break;
      case 2:
        // Пользователь нашел рекламу
        startTimer(timerDuration());
        setStep(3);
        break;
      case 4:
        // Время вышло, пользователь возвращается
        setStep(5);
        break;
      case 5:
        // Пользователь закрыл рекламу
        setStep(6);
        break;
      case 6:
        // Сохранить сумму и перейти к завершению
        if (inputAmount) {
          setStep(7);
        }
        break;
      case 7:
        // Завершение - закрыть модалку
        onClose();
        break;
    }
  };

  // Открыть Telegram
  const handleOpenTelegram = () => {
    window.open(source.telegramLink, "_blank", "noopener,noreferrer");
    setIsTelegramOpen(true);
  };

  // Форматирование времени
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Анимации
  const modalAnimation = {
    hidden: { opacity: 0, scale: 0.9, y: -50 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -50,
      transition: { duration: 0.3 },
    },
  };

  const currentStep = stepDescriptions[step];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Overlay */}
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Модальное окно */}
      <motion.div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        variants={modalAnimation}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Заголовок */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="text-2xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✨
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white">Авто-Пилот</h2>
              <p className="text-sm text-white/60">Пошаговый ассистент</p>
            </div>
          </div>
          <motion.button
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-5 h-5 text-white/60" />
          </motion.button>
        </div>

        {/* Основной контент */}
        <div className="p-4">
          {/* Прогресс-бар */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60">Шаг {step} из 7</span>
              <span className="text-sm text-purple-400">
                {kolobokEmotions[step] || "😊"}
              </span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                initial={{ width: "0%" }}
                animate={{ width: `${((step - 1) / 6) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Основная часть - Колобок говорит */}
          <motion.div
            className="flex items-start gap-4 mb-6"
            key={step}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center backdrop-blur-sm flex-shrink-0"
              animate={timerStatus === "running" ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-xl">{kolobokEmotions[step] || "😊"}</span>
            </motion.div>
            <div>
              <motion.h3
                className="text-lg font-semibold text-white mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Kolobok:
              </motion.h3>
              <motion.p
                className="text-white/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {currentStep.kolobokText}
              </motion.p>
            </div>
          </motion.div>

          {/* Таймер (показываем на шаге 3) */}
          {step === 3 && timerStatus !== "completed" && (
            <motion.div
              className="my-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="relative w-32 h-32 mx-auto">
                {/* Круговой таймер */}
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="url(#timerGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={283}
                    strokeDashoffset={283 - (283 * timer) / timerDuration()}
                    initial={{ strokeDashoffset: 283 }}
                    animate={{ strokeDashoffset: 283 - (283 * timer) / timerDuration() }}
                    transition={{ duration: 0.1 }}
                  />
                  <defs>
                    <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#6366F1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.span
                    className="text-xl font-bold text-white"
                    key={timer}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                  >
                    {formatTime(timer)}
                  </motion.span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Действия пользователя */}
          <motion.div
            className="flex flex-col gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {/* Шаг 1: Открыть Telegram */}
            {step === 1 && (
              <motion.button
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium text-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
                onClick={handleOpenTelegram}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Sparkles className="w-6 h-6" />
                <span>Открыть Telegram</span>
              </motion.button>
            )}

            {/* Шаг 2: Нашел рекламу */}
            {step === 2 && (
              <motion.button
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-purple-600/20 text-purple-300 font-medium text-lg hover:bg-purple-600/30 transition-colors"
                onClick={handleNextStep}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Check className="w-6 h-6" />
                <span>Я нашел рекламу и нажал на неё</span>
              </motion.button>
            )}

            {/* Шаг 4: Время вышло */}
            {step === 4 && (
              <motion.button
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-orange-600/20 text-orange-300 font-medium text-lg hover:bg-orange-600/30 transition-colors"
                onClick={handleNextStep}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Zap className="w-6 h-6" />
                <span>Я вернулся в приложение</span>
              </motion.button>
            )}

            {/* Шаг 5: Закрыл рекламу */}
            {step === 5 && (
              <motion.button
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-green-600/20 text-green-300 font-medium text-lg hover:bg-green-600/30 transition-colors"
                onClick={handleNextStep}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Check className="w-6 h-6" />
                <span>Я закрыл рекламу</span>
              </motion.button>
            )}

            {/* Шаг 6: Ввод суммы */}
            {step === 6 && (
              <>
                <motion.div
                  className="w-full"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <label className="block text-sm text-white/60 mb-2">
                    Сумма заработка
                  </label>
                  <motion.div
                    className="flex items-center gap-2"
                    whileHover={{ scale: 1.01 }}
                  >
                    <input
                      type="number"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      placeholder="0"
                      className="flex-1 px-4 py-3 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-lg"
                    />
                    <span className="text-xl text-white/60">₽</span>
                  </motion.div>
                </motion.div>
                <motion.button
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium text-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleNextStep}
                  disabled={!inputAmount}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Check className="w-6 h-6" />
                  <span>Готово</span>
                </motion.button>
              </>
            )}

            {/* Шаг 7: Завершение */}
            {step === 7 && (
              <motion.button
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium text-lg hover:from-green-700 hover:to-emerald-700 transition-all"
                onClick={handleNextStep}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Heart className="w-6 h-6" />
                <span>Понял!</span>
              </motion.button>
            )}
          </motion.div>

          {/* Подсказка пользователя */}
          {currentStep.userAction && step !== 6 && (
            <motion.p
              className="text-center text-sm text-white/50 mt-4 italic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {currentStep.userAction}
            </motion.p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
