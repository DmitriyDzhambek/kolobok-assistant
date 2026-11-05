import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";
export type VoiceAction = "greeting" | "weather" | "focus" | "timer" | "unknown";

export interface VoiceResult {
  text: string;
  action: VoiceAction;
}

export interface VoiceConfig {
  lang?: string;
}

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type RecognitionConstructor = new () => RecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};
type ListenMode = "off" | "manual" | "wake" | "command";

function getRecognitionConstructor(): RecognitionConstructor | undefined {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function getWakeWordCommand(text: string): string | null {
  const normalized = text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  const wakeWord = /(?<![а-яё])(?:привет\s+)?колобок(?![а-яё])/;
  const match = wakeWord.exec(normalized);
  if (!match) return null;
  return text.slice(match.index + match[0].length).trim().replace(/^[,!.:\s]+/, "");
}

function parseDuration(text: string): number | null {
  const match = text.toLocaleLowerCase("ru-RU").match(
    /(\d{1,3})\s*(секунд[уы]?|сек|минут[уы]?|мин|час(?:а|ов)?)(?![а-яё])/,
  );
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2];
  const multiplier = unit.startsWith("сек")
    ? 1000
    : unit.startsWith("час")
      ? 60 * 60 * 1000
      : 60 * 1000;
  return value * multiplier;
}

function playDing() {
  try {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(1174.66, context.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
    oscillator.onended = () => void context.close();
  } catch (audioError) {
    console.warn("Звуковой сигнал недоступен:", audioError);
  }
}

export function useVoiceAssistant(config: VoiceConfig = {}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(
    () => typeof window !== "undefined" && !!getRecognitionConstructor(),
  );
  const [isWakeWordMode, setIsWakeWordMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [permissionIssue, setPermissionIssue] = useState(false);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const modeRef = useRef<ListenMode>("off");
  const restartTimerRef = useRef<number | null>(null);
  const commandTimerRef = useRef<number | null>(null);
  const productivityReminderRef = useRef<number | null>(null);
  const workTimerRef = useRef<number | null>(null);
  const commandHandlerRef = useRef<(result: VoiceResult) => void>(() => {});
  const restartWakeListeningRef = useRef<() => void>(() => {});
  const scheduleReminderRef = useRef<() => void>(() => {});
  const activeCommandRef = useRef(false);
  const disposedRef = useRef(false);
  const wakeRequestIdRef = useRef(0);
  const startRetryCountRef = useRef(0);

  const clearTimer = (timerRef: React.MutableRefObject<number | null>) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopCurrentRecognition = useCallback((abort = false) => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onend = null;
    try {
      if (abort && recognition.abort) recognition.abort();
      else recognition.stop();
    } catch (stopError) {
      console.warn("Не удалось штатно остановить распознавание:", stopError);
    }
  }, []);

  const speak = useCallback((text: string, rate = 1, pitch = 1) => {
    if (!("speechSynthesis" in window)) {
      return Promise.reject(new Error("Синтез речи не поддерживается"));
    }
    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = config.lang ?? "ru-RU";
      utterance.rate = rate;
      utterance.pitch = pitch;
      const russianVoice = window.speechSynthesis
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().startsWith("ru"));
      if (russianVoice) utterance.voice = russianVoice;
      utterance.onstart = () => setStatus("speaking");
      utterance.onend = () => {
        setStatus("idle");
        resolve();
      };
      utterance.onerror = () => {
        setStatus("idle");
        reject(new Error("Не удалось озвучить ответ"));
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }, [config.lang]);

  const processCommand = useCallback((text: string): VoiceResult => {
    const normalized = text.toLocaleLowerCase("ru-RU");
    const duration = parseDuration(normalized);
    if (duration !== null) {
      const timerDescription = duration >= 60_000
        ? `${Math.round(duration / 60_000)} минут`
        : `${Math.round(duration / 1000)} секунд`;
      return {
        text: `Таймер на ${timerDescription}. Я напомню, когда время выйдет.`,
        action: "timer",
      };
    }
    if (/привет|здарова|как дела|как ты|что нового/i.test(normalized)) {
      return {
        text: "У меня всё отлично! Кстати, в Money Bux появляются новые задания. Может, заработаем?",
        action: "greeting",
      };
    }
    if (/погода|на улице|дождь|снег|солнце|облачно/i.test(normalized)) {
      return {
        text: "Я услышал вопрос о погоде. Открой раздел погоды, чтобы посмотреть прогноз.",
        action: "weather",
      };
    }
    if (/фокус|концентрируйся|учись|учи|английский|хобби|привычк/i.test(normalized)) {
      return {
        text: "Отлично! Давай сосредоточимся на этом деле. Я рядом и помогу держать фокус.",
        action: "focus",
      };
    }
    return {
      text: "Я услышал тебя, но пока не понял команду. Попробуй сказать: «поставь таймер на 10 минут».",
      action: "unknown",
    };
  }, []);

  const executeCommand = useCallback(async (text: string) => {
    const result = processCommand(text);
    commandHandlerRef.current(result);
    if (result.action === "timer") {
      const duration = parseDuration(text);
      if (duration !== null) {
        clearTimer(workTimerRef);
        workTimerRef.current = window.setTimeout(() => {
          workTimerRef.current = null;
          if (!disposedRef.current && document.visibilityState === "visible") {
            stopCurrentRecognition(true);
            void speak("Время вышло! Ты молодец. Сделай небольшой перерыв.")
              .catch((speakError: unknown) =>
                console.error("Не удалось озвучить окончание таймера:", speakError),
              )
              .finally(() => {
                if (modeRef.current === "wake") restartWakeListeningRef.current();
              });
          }
        }, duration);
      }
    }
    try {
      await speak(result.text);
    } catch (speakError) {
      console.error("Не удалось озвучить ответ:", speakError);
    }
    return result;
  }, [processCommand, speak, stopCurrentRecognition]);

  const startRecognitionInstance = useCallback((requestedMode: "wake" | "command" | "manual") => {
    if (disposedRef.current || document.visibilityState !== "visible") return;
    const RecognitionAPI = getRecognitionConstructor();
    if (!RecognitionAPI) {
      modeRef.current = "off";
      setIsWakeWordMode(false);
      setIsListening(false);
      setIsSupported(false);
      setStatus("idle");
      return;
    }

    stopCurrentRecognition(true);
    const recognition = new RecognitionAPI();
    let didStart = false;
    recognition.lang = config.lang ?? "ru-RU";
    recognition.continuous = requestedMode === "wake";
    recognition.interimResults = true;
    modeRef.current = requestedMode;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      didStart = true;
      startRetryCountRef.current = 0;
      setIsListening(true);
      setStatus("listening");
      setError(null);
      setPermissionIssue(false);
      if (requestedMode === "manual") playDing();
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setInterimText(interim);

      const currentMode = modeRef.current;
      if (currentMode === "wake" && (interim || finalText)) {
        scheduleReminderRef.current();
      }
      if (currentMode === "wake") {
        const partial = finalText || interim;
        const command = getWakeWordCommand(partial);
        if (command !== null && !activeCommandRef.current) {
          if (!finalText.trim()) return;
          activeCommandRef.current = true;
          clearTimer(restartTimerRef);
          modeRef.current = "command";
          setStatus("processing");
          stopCurrentRecognition();
          void (async () => {
            playDing();
            try {
              await speak("Да, я здесь. Слушаю тебя.");
            } catch (speakError) {
              console.error("Не удалось озвучить приветствие:", speakError);
            }
            if (modeRef.current !== "command" || document.visibilityState !== "visible") {
              activeCommandRef.current = false;
              modeRef.current = modeRef.current === "command" ? "wake" : modeRef.current;
              return;
            }
            if (command && finalText.trim()) {
              clearTimer(commandTimerRef);
              await executeCommand(command);
              activeCommandRef.current = false;
              modeRef.current = "wake";
              startRecognitionInstance("wake");
            } else {
              clearTimer(commandTimerRef);
              commandTimerRef.current = window.setTimeout(() => {
                commandTimerRef.current = null;
                if (modeRef.current === "command") {
                  activeCommandRef.current = false;
                  modeRef.current = "wake";
                  stopCurrentRecognition(true);
                  startRecognitionInstance("wake");
                }
              }, 7000);
              startRecognitionInstance("command");
            }
          })();
        }
        return;
      }

      if (currentMode === "command" && finalText.trim()) {
        clearTimer(commandTimerRef);
        activeCommandRef.current = false;
        modeRef.current = "wake";
        setInterimText("");
        setStatus("processing");
        stopCurrentRecognition();
        void executeCommand(finalText.trim()).finally(() => {
          if (modeRef.current === "wake" && document.visibilityState === "visible") {
            startRecognitionInstance("wake");
          }
        });
        return;
      }

      if (currentMode === "manual" && finalText.trim()) {
        modeRef.current = "off";
        setInterimText("");
        setStatus("processing");
        setIsListening(false);
        stopCurrentRecognition();
        playDing();
        void executeCommand(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        modeRef.current = "off";
        setIsWakeWordMode(false);
        setStatus("error");
        setInterimText("");
        setPermissionIssue(true);
        setError("Разреши доступ к микрофону в настройках браузера.");
      } else if (event.error === "network" || event.error === "audio-capture") {
        modeRef.current = "off";
        setIsWakeWordMode(false);
        setStatus("error");
        setError(
          event.error === "audio-capture"
            ? "Микрофон недоступен. Проверь подключение устройства."
            : "Распознавание речи недоступно. Проверь подключение к интернету.",
        );
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        modeRef.current = "off";
        setIsWakeWordMode(false);
        setStatus("error");
        setError("Проблема с распознаванием речи. Проверь подключение и микрофон.");
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      if (requestedMode === "manual" && didStart) playDing();
      if (modeRef.current === "command") {
        clearTimer(commandTimerRef);
        activeCommandRef.current = false;
        modeRef.current = "wake";
      }
      if (modeRef.current === "wake" && document.visibilityState === "visible") {
        clearTimer(restartTimerRef);
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (modeRef.current === "wake" && document.visibilityState === "visible") {
            startRecognitionInstance("wake");
          }
        }, 300);
      } else if (modeRef.current === "manual") {
        modeRef.current = "off";
        setStatus("idle");
      }
    };

    try {
      recognition.start();
    } catch (startError) {
      setIsListening(false);
      const denied =
        startError instanceof DOMException &&
        ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(
          startError.name,
        ) ||
        (startError instanceof Error &&
          /permission denied|not allowed/i.test(startError.message));
      if (denied) {
        modeRef.current = "off";
        setIsWakeWordMode(false);
        setStatus("error");
        setPermissionIssue(true);
        setError(
          "Пожалуйста, разреши доступ к микрофону в настройках браузера (нажми на замочек в адресной строке).",
        );
      } else if (modeRef.current === "wake" && startRetryCountRef.current < 5) {
        startRetryCountRef.current += 1;
        clearTimer(restartTimerRef);
        restartTimerRef.current = window.setTimeout(
          () => startRecognitionInstance("wake"),
          Math.min(300 * 2 ** startRetryCountRef.current, 5000),
        );
      } else {
        modeRef.current = "off";
        setIsWakeWordMode(false);
        setStatus("error");
        setPermissionIssue(false);
        setError("Не удалось запустить микрофон. Проверь разрешения и попробуй ещё раз.");
        console.error("Не удалось запустить распознавание:", startError);
      }
    }
  }, [config.lang, executeCommand, speak, stopCurrentRecognition]);
  restartWakeListeningRef.current = () => startRecognitionInstance("wake");

  const scheduleProductivityReminder = useCallback(() => {
    clearTimer(productivityReminderRef);
    if (modeRef.current !== "wake" || document.visibilityState !== "visible") return;
    productivityReminderRef.current = window.setTimeout(() => {
      productivityReminderRef.current = null;
      if (modeRef.current !== "wake" || document.visibilityState !== "visible") return;
      stopCurrentRecognition(true);
      setIsListening(false);
      void speak("Эй, ты тут? Я скучаю. Давай поставим таймер на учёбу.")
        .catch((speakError: unknown) =>
          console.error("Не удалось озвучить напоминание:", speakError),
        )
        .finally(() => {
          if (modeRef.current === "wake") startRecognitionInstance("wake");
        });
    }, 10 * 60 * 1000);
  }, [speak, startRecognitionInstance, stopCurrentRecognition]);
  scheduleReminderRef.current = scheduleProductivityReminder;

  const requestMicrophonePermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Микрофон доступен только на HTTPS-сайте или localhost.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  }, []);

  const setWakeWordMode = useCallback(async (enabled: boolean) => {
    const requestId = ++wakeRequestIdRef.current;
    clearTimer(restartTimerRef);
    clearTimer(commandTimerRef);
    modeRef.current = "off";
    activeCommandRef.current = false;
    stopCurrentRecognition(true);
    setInterimText("");
    setError(null);
    setPermissionIssue(false);
    if (!enabled) {
      clearTimer(productivityReminderRef);
      setIsWakeWordMode(false);
      setIsListening(false);
      setPermissionIssue(false);
      setStatus("idle");
      return;
    }
    if (!getRecognitionConstructor()) {
      setIsSupported(false);
      return;
    }
    try {
      await requestMicrophonePermission();
      if (requestId !== wakeRequestIdRef.current || disposedRef.current) return;
      modeRef.current = "wake";
      setIsWakeWordMode(true);
      playDing();
      startRecognitionInstance("wake");
      scheduleProductivityReminder();
    } catch (permissionError) {
      if (requestId !== wakeRequestIdRef.current || disposedRef.current) return;
      modeRef.current = "off";
      setIsWakeWordMode(false);
      setInterimText("");
      setPermissionIssue(true);
      setError(
        "Пожалуйста, разреши доступ к микрофону в настройках браузера (нажми на замочек в адресной строке).",
      );
      setStatus("error");
    }
  }, [isSupported, requestMicrophonePermission, scheduleProductivityReminder, startRecognitionInstance, stopCurrentRecognition]);

  const startRecognition = useCallback(async () => {
    wakeRequestIdRef.current += 1;
    if (!getRecognitionConstructor()) {
      setIsSupported(false);
      return;
    }
    clearTimer(productivityReminderRef);
    modeRef.current = "off";
    setIsWakeWordMode(false);
    setPermissionIssue(false);
    setError(null);
    stopCurrentRecognition(true);
    try {
      await requestMicrophonePermission();
      modeRef.current = "manual";
      startRecognitionInstance("manual");
    } catch (permissionError) {
      const domException = permissionError as DOMException;
      const denied =
        domException.name === "NotAllowedError" ||
        domException.name === "PermissionDeniedError" ||
        domException.name === "SecurityError" ||
        /permission denied|not allowed/i.test(domException.message);
      setInterimText("");
      setPermissionIssue(denied);
      setError(
        denied
          ? "Пожалуйста, разреши доступ к микрофону в настройках браузера (нажми на замочек в адресной строке)."
          : permissionError instanceof Error
            ? permissionError.message
            : "Не удалось получить доступ к микрофону.",
      );
      setStatus("error");
    }
  }, [isSupported, requestMicrophonePermission, startRecognitionInstance, stopCurrentRecognition]);

  const stopRecognition = useCallback(() => {
    wakeRequestIdRef.current += 1;
    modeRef.current = "off";
    activeCommandRef.current = false;
    clearTimer(restartTimerRef);
    clearTimer(commandTimerRef);
    clearTimer(productivityReminderRef);
    stopCurrentRecognition(true);
    window.speechSynthesis?.cancel();
    playDing();
    setIsWakeWordMode(false);
    setIsListening(false);
    setInterimText("");
    setStatus("idle");
  }, [stopCurrentRecognition]);

  const setOnCommandResult = useCallback((handler: (result: VoiceResult) => void) => {
    commandHandlerRef.current = handler;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setPermissionIssue(false);
    if (status === "error") setStatus("idle");
  }, [status]);

  useEffect(() => {
    disposedRef.current = false;
    const supported = !!getRecognitionConstructor();
    setIsSupported(supported);
    return () => {
      disposedRef.current = true;
      modeRef.current = "off";
      clearTimer(restartTimerRef);
      clearTimer(commandTimerRef);
      clearTimer(productivityReminderRef);
      clearTimer(workTimerRef);
      stopCurrentRecognition(true);
      window.speechSynthesis?.cancel();
    };
  }, [stopCurrentRecognition]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimer(restartTimerRef);
        clearTimer(commandTimerRef);
        clearTimer(productivityReminderRef);
        if (modeRef.current === "command") {
          activeCommandRef.current = false;
          modeRef.current = "wake";
        }
        stopCurrentRecognition(true);
        setIsListening(false);
        return;
      }
      if (modeRef.current === "wake") {
        scheduleProductivityReminder();
        clearTimer(restartTimerRef);
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (modeRef.current === "wake") startRecognitionInstance("wake");
        }, 300);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [scheduleProductivityReminder, startRecognitionInstance, stopCurrentRecognition]);

  return {
    status,
    interimText,
    error,
    isSupported,
    isWakeWordMode,
    isListening,
    permissionIssue,
    setWakeWordMode,
    startRecognition,
    stopRecognition,
    speak,
    processCommand,
    runCommand: executeCommand,
    setOnCommandResult,
    clearError,
  };
}
