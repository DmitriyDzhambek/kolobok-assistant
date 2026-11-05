import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Gift,
  Home,
  Mic,
  MicOff,
  Sparkles,
  Users,
} from "lucide-react";
import { Kolobok } from "./components/Kolobok";
import { Background } from "./components/Background";
import { FirefliesCanvas } from "./components/FirefliesCanvas";
import { Dashboard } from "./components/Dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MagicIncome } from "./components/MagicIncome";
import { PartnerTab } from "./components/PartnerTab";
import { DreamJar } from "./components/DreamJar";
import { EnglishModal } from "./components/EnglishModal";
import { useVoiceAssistant } from "./hooks/useVoiceAssistant";
import type { ActiveVoiceTimer } from "./hooks/useVoiceAssistant";
import { localAdd, localHabitsView, localMark } from "./habits/localStore";
import { recordCryptoEarning, type CryptoCurrency } from "./dreams/storage";
import { initTma, tgWebApp } from "./tma";
import type { TimeOfDay } from "./utils/timeContext";
import "./styles.css";

/**
 * Тип вкладки
 */
type TabType = "main" | "magic" | "partner" | "dreams";

const CRYSTALS_KEY = "kolobok.english-crystals.v1";

function readCrystals(): number {
  try {
    if (typeof window === "undefined") return 0;
    const saved = Number(window.localStorage.getItem(CRYSTALS_KEY) ?? "0");
    return Number.isFinite(saved) ? Math.max(0, saved) : 0;
  } catch (error) {
    console.error("Не удалось прочитать счётчик кристаллов:", error);
    return 0;
  }
}

/**
 * Приложение Kolobok с голосовым ассистентом и навигацией
 */
export default function App() {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("night");
  const [activeTab, setActiveTab] = useState<TabType>("main");
  const [botText, setBotText] = useState("Привет! Я Колобок. Ты отдыхай, а я для тебя заработаю!");
  const [commandDraft, setCommandDraft] = useState("");
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  const [activeTimer, setActiveTimer] = useState<ActiveVoiceTimer | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [isEnglishOpen, setIsEnglishOpen] = useState(false);
  const [crystals, setCrystals] = useState(readCrystals);
  const [dreamRevision, setDreamRevision] = useState(0);
  const [suggestedProjectId, setSuggestedProjectId] = useState<string>();
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
    speak,
    setOnCommandResult,
    setOnTimerChange,
    clearError,
  } = useVoiceAssistant({ lang: "ru-RU" });
  const handleCommandResult = useCallback((result: {
    text: string;
    action?: string;
    suggestedProjectId?: string;
  }) => {
    setBotText(result.text);
    if (result.action === "earningSuggestion" && result.suggestedProjectId) {
      setSuggestedProjectId(result.suggestedProjectId);
      setActiveTab("magic");
    }
  }, []);

  useEffect(() => {
    setOnCommandResult(handleCommandResult);
  }, [handleCommandResult, setOnCommandResult]);

  const handleTimerChange = useCallback((timer: ActiveVoiceTimer | null) => {
    setActiveTimer(timer);
  }, []);

  useEffect(() => {
    setOnTimerChange(handleTimerChange);
  }, [handleTimerChange, setOnTimerChange]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6 || hour >= 11) return;
    const today = new Date().toLocaleDateString("sv-SE");
    const greetingKey = "kolobok.morning-greeting.v1";
    try {
      if (window.localStorage.getItem(greetingKey) === today) return;
      window.localStorage.setItem(greetingKey, today);
    } catch (storageError) {
      console.error("Не удалось сохранить отметку утреннего приветствия:", storageError);
    }

    const greeting =
      "Доброе утро! Погоду можно проверить по твоему местоположению в карточке. Твой фокус дня — Английский. Выполним? Или сразу пойдём в Магию зарабатывать?";
    setBotText(greeting);
    void speak(greeting).catch((speechError: unknown) =>
      console.info("Браузер не разрешил автоматическое утреннее озвучивание:", speechError),
    );
  }, [speak]);

  useEffect(() => {
    if (!activeTimer) return;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer]);

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

  const handleEnglishLearned = useCallback(() => {
    const nextCrystals = crystals + 10;
    let crystalsSaved = true;
    try {
      window.localStorage.setItem(CRYSTALS_KEY, String(nextCrystals));
      setCrystals(nextCrystals);
    } catch (storageError) {
      crystalsSaved = false;
      console.error("Не удалось сохранить кристаллы за урок:", storageError);
    }

    let englishHabit = localHabitsView().habits.find((habit) =>
      /английск/i.test(habit.title),
    );
    if (!englishHabit) {
      const addError = localAdd("Английский", "📘");
      englishHabit = localHabitsView().habits.find((habit) =>
        /английск/i.test(habit.title),
      );
      if (!englishHabit && addError) {
        console.error("Не удалось добавить привычку «Английский»:", addError);
      }
    }
    if (englishHabit) localMark(englishHabit.id, "done");
    setBotText(
      crystalsSaved
        ? englishHabit
          ? "Отличная работа! +10 кристаллов и привычка «Английский» отмечена."
          : "Слово выучено и +10 кристаллов начислены, но привычку «Английский» добавить не удалось."
        : "Слово выучено! Кристаллы не сохранились — проверь память браузера.",
    );
  }, [crystals]);

  const handleEarningRecorded = useCallback(
    (amount: number, currency: CryptoCurrency): boolean => {
      try {
        recordCryptoEarning(amount, currency);
        setDreamRevision((revision) => revision + 1);
        setBotText(`Записал ${amount} ${currency} в баланс Сундука желаний.`);
        return true;
      } catch (earningError) {
        console.error("Не удалось записать заработок в сундук желаний:", earningError);
        return false;
      }
    },
    [],
  );

  const handleSuggestionHandled = useCallback(() => {
    setSuggestedProjectId(undefined);
  }, []);

  // Переключение вкладок
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (isListening || isWakeWordMode) {
      stopRecognition();
    }
  };
  const visibleError = permissionIssue ? null : error;
  const timerSeconds = activeTimer
    ? Math.max(0, Math.ceil((activeTimer.endsAt - timerNow) / 1000))
    : 0;
  const timerProgress = activeTimer
    ? Math.max(0, Math.min(1, (activeTimer.endsAt - timerNow) / activeTimer.durationMs))
    : 0;
  const timerLabel = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`;

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
              <Dashboard onFocusClick={() => setIsEnglishOpen(true)} />

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
                <AnimatePresence>
                  {activeTimer && (
                    <motion.div
                      className="active-timer"
                      role="timer"
                      aria-label={`До окончания таймера ${timerLabel}`}
                      aria-live="off"
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                    >
                      <svg className="active-timer-ring" viewBox="0 0 80 80" aria-hidden="true">
                        <circle className="active-timer-track" cx="40" cy="40" r="35" />
                        <circle
                          className="active-timer-progress"
                          cx="40"
                          cy="40"
                          r="35"
                          style={{
                            strokeDasharray: 2 * Math.PI * 35,
                            strokeDashoffset: 2 * Math.PI * 35 * (1 - timerProgress),
                          }}
                        />
                      </svg>
                      <Clock className="active-timer-icon" aria-hidden="true" />
                      <span className="active-timer-label">{timerLabel}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  className={`mt-6 relative home-mic-wrap${activeTimer ? " has-active-timer" : ""}`}
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
              <MagicIncome
                suggestedProjectId={suggestedProjectId}
                onSuggestionHandled={handleSuggestionHandled}
                onEarningRecorded={handleEarningRecorded}
              />
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

          {activeTab === "dreams" && (
            <motion.main
              key="dreams"
              className="stage relative app-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DreamJar revision={dreamRevision} />
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

          <motion.button
            className={`bottom-nav-button${activeTab === "dreams" ? " is-active" : ""}`}
            onClick={() => handleTabChange("dreams")}
            type="button"
            aria-current={activeTab === "dreams" ? "page" : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Gift className="w-5 h-5" />
            <span>Мечты</span>
          </motion.button>
        </div>
      </motion.nav>

      <EnglishModal
        isOpen={isEnglishOpen}
        crystals={crystals}
        onClose={() => setIsEnglishOpen(false)}
        onLearned={handleEnglishLearned}
      />

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
