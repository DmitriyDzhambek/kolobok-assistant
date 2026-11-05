import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Clock, DollarSign, Check, Sparkles } from "lucide-react";

/**
 * Шаги автопилота для визуального отображения
 */
type AutoPilotStep = 1 | 2 | 3;

/**
 * Пропсы компонента
 */
export interface AutoPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Описание шагов
 */
const steps = {
  1: {
    title: "АВТО-ПИЛОТ",
    kolobokEmoji: "🌕",
    kolobokAnimation: "pulse",
    text: "Я беру управление на себя. Нажми кнопку ниже, чтобы перейти к заданию",
    buttonText: "ОТКРЫТЬ TELEGRAM",
    buttonIcon: <Sparkles className="w-5 h-5" />,
    buttonVariant: "primary",
  },
  2: {
    title: "АВТО-ПИЛОТ",
    kolobokEmoji: "🧘",
    kolobokAnimation: "meditate",
    text: "Тсс... Идет просмотр. Иди налей кофе, я разбужу тебя через 15 секунд",
    buttonText: "Далее",
    buttonIcon: <Clock className="w-5 h-5" />,
    buttonVariant: "secondary",
    showTimer: true,
  },
  3: {
    title: "АВТО-ПИЛОТ",
    kolobokEmoji: "😃",
    kolobokAnimation: "jump",
    text: "Время вышло! Беги закрывать крестик! Сколько ты заработал?",
    buttonText: "Забрать награду",
    buttonIcon: <DollarSign className="w-5 h-5" />,
    buttonVariant: "success",
    showInput: true,
  },
};

/**
 * Анимации для Колобка
 */
const kolobokAnimations: Record<string, any> = {
  pulse: {
    scale: [1, 1.05, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
  meditate: {
    y: [0, -5, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
  jump: {
    y: [0, -20, 0],
    transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
  },
};

/**
 * Стили кнопок
 */
const buttonStyles: Record<string, string> = {
  primary: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white",
  secondary: "bg-white/10 border border-white/20 text-white",
  success: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
};

/**
 * Визуальное модальное окно Авто-Пилот
 * 3 шага с красивыми анимациями и дизайном
 */
export function AutoPilotModal({ isOpen, onClose }: AutoPilotModalProps) {
  const [step, setStep] = useState<AutoPilotStep>(1);
  const [amount, setAmount] = useState("");

  const currentStep = steps[step];

  // Переход к следующему шагу
  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => (prev + 1) as AutoPilotStep);
    } else {
      onClose();
    }
  };

  // Закрытие модалки
  const handleClose = () => {
    setStep(1);
    setAmount("");
    onClose();
  };

  // Анимация модалки
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

  // Анимация контента
  const contentAnimation = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: 0.2 },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: { duration: 0.3 },
    },
  };

  // Форматирование суммы
  const formattedAmount = amount
    ? new Intl.NumberFormat("ru-RU").format(parseInt(amount) || 0)
    : "0";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Модальное окно */}
          <motion.div
            className="relative w-full max-w-md bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            variants={modalAnimation}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Заголовок */}
            <motion.div
              className="relative p-4 border-b border-white/10"
              variants={contentAnimation}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="text-2xl"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ✨
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {currentStep.title}
                    </h2>
                    <p className="text-xs text-cyan-400">
                      Шаг {step} из 3
                    </p>
                  </div>
                </div>
                <motion.button
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  onClick={handleClose}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5 text-white/60" />
                </motion.button>
              </div>

              {/* Прогресс-бар */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-1.5 rounded-full transition-all ${
                        i < step ? "bg-purple-500" : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Основной контент */}
            <motion.div
              className="relative p-6 min-h-[400px] flex flex-col items-center justify-center"
              variants={contentAnimation}
            >
              {/* Колобок */}
              <motion.div
                className="relative mb-6"
                animate={kolobokAnimations[currentStep.kolobokAnimation]}
              >
                {/* Аватар Колобка (заглушка) */}
                <motion.div
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-yellow-500/30"
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="text-4xl">{currentStep.kolobokEmoji}</span>
                </motion.div>

                {/* Эффект свечения */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-yellow-400/30"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Круговой таймер (только на шаге 2) */}
                {currentStep.showTimer && (
                  <motion.div
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="48"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="3"
                        fill="none"
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="48"
                        stroke="url(#timerGradient)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={301}
                        strokeDashoffset={301 * 0.5} // 50% заполнен
                        initial={{ strokeDashoffset: 301 }}
                        animate={{ strokeDashoffset: 301 * 0.5 }}
                        transition={{ duration: 0.5 }}
                      />
                      <defs>
                        <linearGradient
                          id="timerGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </motion.div>
                )}
              </motion.div>

              {/* Текст Колобка */}
              <motion.div
                className="text-center mb-8 max-w-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.p
                  className="text-lg text-white/90 mb-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Kolobok:
                </motion.p>
                <motion.p
                  className="text-white"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {currentStep.text}
                </motion.p>
              </motion.div>

              {/* Поле ввода (только на шаге 3) */}
              {currentStep.showInput && (
                <motion.div
                  className="w-full max-w-xs mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <label className="block text-sm text-white/60 mb-2">
                    Сумма заработка
                  </label>
                  <motion.div
                    className="relative"
                    whileHover={{ scale: 1.01 }}
                  >
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-4 pr-12 py-3 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-lg text-center"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-white/60">
                      ₽
                    </span>
                  </motion.div>
                  {amount && (
                    <motion.p
                      className="text-center text-2xl font-bold text-green-400 mt-2"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {formattedAmount} ₽
                    </motion.p>
                  )}
                </motion.div>
              )}

              {/* Кнопка действия */}
              <motion.button
                className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-medium text-lg transition-all shadow-lg ${
                  buttonStyles[currentStep.buttonVariant]
                } ${step === 2 ? "w-full" : "w-auto"}`}
                onClick={handleNext}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                {currentStep.buttonIcon}
                <span>{currentStep.buttonText}</span>
              </motion.button>

              {/* Подсказка (шаг 2) */}
              {step === 2 && (
                <motion.p
                  className="text-center text-sm text-cyan-400 mt-4 italic"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  Они всех ровно я жду...
                </motion.p>
              )}
            </motion.div>

            {/* Нижний декоративный элемент */}
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full" />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Экспорт для использования в других компонентах
export default AutoPilotModal;
