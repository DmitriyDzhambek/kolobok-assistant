import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Sparkles, Users, WandSparkles } from "lucide-react";
import { Kolobok } from "./components/Kolobok";
import { Background } from "./components/Background";
import { FirefliesCanvas } from "./components/FirefliesCanvas";
import { Dashboard } from "./components/Dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MagicIncome } from "./components/MagicIncome";
import { PartnerTab } from "./components/PartnerTab";
import { useVoiceAssistant } from "./hooks/useVoiceAssistant";
import { initTma, tgWebApp } from "./tma";
import type { TimeOfDay } from "./utils/timeContext";
import "./styles.css";

/**
 * Тип вкладки
 */
type TabType = "main" | "magic" | "partner";

/**
 * Приложение Kolobok с голосовым ассистентом и навигацией
 */
export default function App() {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("night");
  const [activeTab, setActiveTab] = useState<TabType>("main");
  const [botText, setBotText] = useState("Привет! Я Колобок. Ты отдыхай, а я для тебя заработаю!");
  const [isListening, setIsListening] = useState(false);
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);

  useEffect(() => {
    initTma();
    const detectTelegram = () => {
      if (tgWebApp()) {
        setIsTelegramMiniApp(true);
        clearInterval(interval);
      }
    };
    const interval = window.setInterval(detectTelegram, 250);
    detectTelegram();
    const timeout = window.setTimeout(() => clearInterval(interval), 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

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
    <div className={`app tod-${timeOfDay}`} data-platform={isTelegramMiniApp ? "telegram" : "web"}>
      <Background />
      <FirefliesCanvas />

      <header className="hdr">
        <h1 className="title">Колобок</h1>
        <div className="subtitle">
          Сказочный помощник твоего рабочего стола
        </div>
      </header>

      <ErrorBoundary onGoHome={() => setActiveTab("main")}>
        <AnimatePresence mode="popLayout">
          {activeTab === "main" && (
            <motion.main
              key="main"
              className="stage relative app-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Интерактивный дашборд */}
              <Dashboard />

              {/* Колобок по центру */}
              <div className="home-content">
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

                {/* Волшебная кнопка-палочка */}
                <motion.div
                  className="mt-6 relative"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <motion.button
                    className="home-mic-button"
                    onClick={handleMicClick}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={!isSupported}
                  >
                    <WandSparkles className="w-8 h-8 text-white" />
                    {!isSupported && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-red-400 whitespace-nowrap">
                        Не поддерживается
                      </div>
                    )}
                  </motion.button>
                </motion.div>
              </div>
            </motion.main>
          )}

          {activeTab === "magic" && (
            <motion.main
              key="magic"
              className="stage relative app-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <MagicIncome />
            </motion.main>
          )}

          {activeTab === "partner" && (
            <motion.main
              key="partner"
              className="stage relative app-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PartnerTab />
            </motion.main>
          )}
        </AnimatePresence>
      </ErrorBoundary>

      {/* Bottom Navigation */}
      <motion.nav
        className="bottom-nav"
        aria-label="Основная навигация"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="bottom-nav-inner">
          <motion.button
            className={`bottom-nav-button${activeTab === "main" ? " is-active" : ""}`}
            onClick={() => handleTabChange("main")}
            type="button"
            aria-current={activeTab === "main" ? "page" : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Home className="w-5 h-5" />
            <span>Колобок</span>
          </motion.button>
          
          <motion.button
            className={`bottom-nav-button${activeTab === "magic" ? " is-active" : ""}`}
            onClick={() => handleTabChange("magic")}
            type="button"
            aria-current={activeTab === "magic" ? "page" : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="w-5 h-5" />
            <span>Магия</span>
          </motion.button>

          <motion.button
            className={`bottom-nav-button${activeTab === "partner" ? " is-active" : ""}`}
            onClick={() => handleTabChange("partner")}
            type="button"
            aria-current={activeTab === "partner" ? "page" : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Users className="w-5 h-5" />
            <span>Партнёр</span>
          </motion.button>
        </div>
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
