import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Mic, MicOff, Sparkles, Users } from "lucide-react";
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
  const [commandDraft, setCommandDraft] = useState("");
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

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
    isListening,
    interimText,
    error,
    isSupported,
    isWakeWordMode,
    permissionIssue,
    startRecognition,
    stopRecognition,
    setWakeWordMode,
    runCommand,
    setOnCommandResult,
    clearError,
  } = useVoiceAssistant({ lang: "ru-RU" });
  const handleCommandResult = useCallback((result: { text: string }) => {
    setBotText(result.text);
  }, []);

  useEffect(() => {
    setOnCommandResult(handleCommandResult);
  }, [handleCommandResult, setOnCommandResult]);

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

  // Обработка клика по микрофону
  const handleMicClick = useCallback(() => {
    if (!isSupported) {
      fallbackInputRef.current?.focus();
    } else if (isListening) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [isListening, isSupported, startRecognition, stopRecognition]);

  const handleFallbackSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = commandDraft.trim();
    if (!text) return;
    setCommandDraft("");
    try {
      await runCommand(text);
    } catch (speakError) {
      console.error("Не удалось озвучить ответ:", speakError);
    }
  };

  const handleWakeWordToggle = () => {
    void setWakeWordMode(!isWakeWordMode);
  };

  // Переключение вкладок
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (isListening || isWakeWordMode) {
      stopRecognition();
    }
  };
  const visibleError = permissionIssue ? null : error;

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
                <Kolobok
                  state={isListening ? "listen" : "idle"}
                  timeOfDay={timeOfDay}
                  wakeWordActive={isWakeWordMode}
                />

                {/* Облачко с текстом */}
                <motion.div
                  className={`bubble mt-4 min-w-[280px]${visibleError ? " bubble-error" : ""}`}
                  key={visibleError ? `error-${visibleError}` : botText}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="bubble-text whitespace-pre-wrap">
                    {visibleError || botText}
                  </div>
                  {!visibleError && interimText && (
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
                    animate={
                      isListening || !isSupported
                        ? { scale: [1, 1.1, 1], boxShadow: ["0 0 22px rgba(255,215,102,.4)", "0 0 38px rgba(45,212,191,.58)", "0 0 22px rgba(255,215,102,.4)"] }
                        : { scale: 1, boxShadow: "0 0 28px rgba(245,158,11,.4)" }
                    }
                    transition={
                      isListening || !isSupported
                        ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.2 }
                    }
                    aria-label={
                      isSupported
                        ? isListening
                          ? "Остановить микрофон"
                          : "Начать голосовой ввод"
                        : "Перейти к вводу команды"
                    }
                  >
                    {isListening ? (
                      <MicOff className="w-7 h-7 text-white" />
                    ) : (
                      <Mic className="w-7 h-7 text-white" />
                    )}
                  </motion.button>
                </motion.div>
                {isSupported ? (
                  <button
                    type="button"
                    className={`wake-word-toggle${isWakeWordMode ? " is-enabled" : ""}`}
                    role="switch"
                    aria-checked={isWakeWordMode}
                    onClick={handleWakeWordToggle}
                  >
                    <span className="wake-word-toggle-track" aria-hidden="true">
                      <span />
                    </span>
                    <span>Режим: {isWakeWordMode ? "Слушаю" : "выключен"}</span>
                  </button>
                ) : (
                  <p className="wake-word-hint" role="status">
                    Постоянное распознавание недоступно. Нажми на микрофон и введи
                    команду с клавиатуры или воспользуйся голосовым вводом клавиатуры.
                  </p>
                )}
                {!isSupported && (
                  <form className="voice-fallback-form" onSubmit={handleFallbackSubmit}>
                    <label className="voice-fallback-label" htmlFor="voice-fallback">
                      Команда для Колобка
                    </label>
                    <div className="voice-fallback-row">
                      <input
                        ref={fallbackInputRef}
                        id="voice-fallback"
                        type="text"
                        value={commandDraft}
                        onChange={(event) => setCommandDraft(event.target.value)}
                        placeholder="Например: таймер на 10 минут"
                        autoComplete="off"
                      />
                      <button type="submit" disabled={!commandDraft.trim()}>
                        Сказать
                      </button>
                    </div>
                  </form>
                )}
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

      {permissionIssue && (
        <div className="permission-overlay" role="presentation">
          <section
            className="permission-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="permission-title"
          >
            <h2 id="permission-title">Нужен доступ к микрофону</h2>
            <p>
              Пожалуйста, разреши доступ к микрофону в настройках браузера
              (нажми на замочек в адресной строке).
            </p>
            <button type="button" onClick={clearError}>
              Понятно
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
