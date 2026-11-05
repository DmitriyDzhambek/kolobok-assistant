import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Home, Sparkles } from "lucide-react";
import { Kolobok } from "./components/Kolobok";
import { Background } from "./components/Background";
import { FirefliesCanvas } from "./components/FirefliesCanvas";
import { Dashboard } from "./components/Dashboard";
import { MagicIncome } from "./components/MagicIncome";
import { useVoiceAssistant } from "./hooks/useVoiceAssistant";
import "./styles.css";

/**
 * Тип вкладки
 */
type TabType = "main" | "magic";

/**
 * Приложение Kolobok с голосовым ассистентом и навигацией
 */
export default function App() {
  const [timeOfDay, setTimeOfDay] = useState("night");
  const [activeTab, setActiveTab] = useState<TabType>("main");
  const [botText, setBotText] = useState("Привет! Я Колобок. Ты отдыхай, а я для тебя заработаю!");
  const [isListening, setIsListening] = useState(false);

  // Голосовой ассистент
  const {
    status,
    interimText,
    error,
    isSupported,
    startRecognition,
    stopRecognition,
    speak,
    processCommand,
    startVoiceSession,
  } = useVoiceAssistant({ lang: "ru-RU", continuous: false });

  // Обновляем время суток
  useEffect(() => {
    const updateTimeOfDay = () => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 12) setTimeOfDay("morning");
      else if (hour >= 12 && hour < 18) setTimeOfDay("day");
      else if (hour >= 18 && hour < 22) setTimeOfDay("evening");
      else setTimeOfDay("night");
    };
    updateTimeOfDay();
    const interval = setInterval(updateTimeOfDay, 60000);
    return () => clearInterval(interval);
  }, []);

  // Синхронизация статуса микрофона
  useEffect(() => {
    setIsListening(status === "listening");
  }, [status]);

  // Обработка результата распознавания
  useEffect(() => {
    if (status === "processing" && interimText === "") {
      const recognition = (window as any).speechRecognitionResult;
      if (recognition) {
        let finalText = "";
        for (let i = 0; i < recognition.results.length; i++) {
          if (recognition.results[i].isFinal) {
            finalText += recognition.results[i][0].transcript;
          }
        }
        if (finalText) {
          handleVoiceInput(finalText);
        }
      }
    }
  }, [status, interimText]);

  // Обработка голосового ввода
  const handleVoiceInput = useCallback(async (text: string) => {
    const result = processCommand(text);
    setBotText(result.text);
    
    // Озвучиваем ответ
    try {
      await speak(result.text);
    } catch (err) {
      console.error("Ошибка озвучки:", err);
    }
    
    // Дополнительные действия в зависимости от команды
    if (result.action === "focus") {
      // Можно добавить логику для добавления задачи
    }
  }, [processCommand, speak]);

  // Ручная обработка текста (для тестирования)
  const handleTestInput = useCallback(async (text: string) => {
    const result = processCommand(text);
    setBotText(result.text);
    try {
      await speak(result.text);
    } catch (err) {
      console.error("Ошибка озвучки:", err);
    }
  }, [processCommand, speak]);

  // Обработка клика по микрофону
  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [isListening, startRecognition, stopRecognition]);

  // Переключение вкладок
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Останавливаем прослушивание при смене вкладки
    if (isListening) {
      stopRecognition();
    }
  };

  // Анимация микрофона
  const micAnimation = {
    idle: { scale: 1, boxShadow: "0 0 20px rgba(255,255,255,0.2)" },
    listening: {
      scale: [1, 1.05, 1],
      boxShadow: [
        "0 0 20px rgba(255,255,255,0.2)",
        "0 0 30px rgba(139,92,246,0.5)",
        "0 0 20px rgba(255,255,255,0.2)",
      ],
    },
  };

  return (
    <div className={`app tod-${timeOfDay}`}>
      <Background />
      <FirefliesCanvas />

      <header className="hdr">
        <h1 className="title">Колобок</h1>
        <div className="subtitle">
          Сказочный помощник твоего рабочего стола
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === "main" && (
          <motion.main
            key="main"
            className="stage relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Интерактивный дашборд */}
            <Dashboard />

            {/* Колобок по центру */}
            <div className="relative z-10 flex flex-col items-center">
              <Kolobok state={isListening ? "listen" : "idle"} timeOfDay={timeOfDay} />
              
              {/* Облачко с текстом */}
              <motion.div
                className="bubble mt-4 min-w-[280px]"
                key={botText}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bubble-text whitespace-pre-wrap">
                  {error ? error : botText}
                </div>
                {interimText && (
                  <div className="bubble-text text-white/60 italic mt-1">
                    {interimText}...
                  </div>
                )}
              </motion.div>

              {/* Кнопка микрофона */}
              <motion.div
                className="mt-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <motion.button
                  className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border-2 border-purple-500/30 backdrop-blur-md cursor-pointer transition-all"
                  onClick={handleMicClick}
                  variants={micAnimation}
                  animate={isListening ? "listening" : "idle"}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={!isSupported}
                >
                  {isListening ? (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-purple-400"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                      <MicOff className="w-8 h-8 text-purple-300" />
                    </>
                  ) : (
                    <>
                      <Mic className="w-8 h-8 text-purple-300" />
                      {!isSupported && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-red-400 whitespace-nowrap">
                          Не поддерживается
                        </div>
                      )}
                    </>
                  )}
                </motion.button>
              </motion.div>
            </div>
          </motion.main>
        )}

        {activeTab === "magic" && (
          <motion.div
            key="magic"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen"
          >
            <MagicIncome />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <motion.nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-6 z-50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <motion.div
          className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 shadow-xl"
          whileHover={{ scale: 1.02 }}
        >
          <motion.button
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === "main"
                ? "bg-purple-600/20 text-purple-300"
                : "text-white/60 hover:bg-white/10"
            }`}
            onClick={() => handleTabChange("main")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Home className="w-5 h-5" />
            <span>Колобок</span>
          </motion.button>
          
          <motion.button
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === "magic"
                ? "bg-purple-600/20 text-purple-300"
                : "text-white/60 hover:bg-white/10"
            }`}
            onClick={() => handleTabChange("magic")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="w-5 h-5" />
            <span>Магия</span>
          </motion.button>
        </motion.div>
      </motion.nav>

      {/* Подсказка для микрофона (если ошибка) */}
      {error && status === "error" && (
        <motion.div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
