import { useCallback, useEffect, useRef, useState } from "react";
import { localHabitsView } from "../habits/localStore";
import { findQuickEarningProject } from "../data/earningProjects";
import { getPreferredSpeechVoice } from "../speech/preferredVoice";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";
export type VoiceAction =
  | "greeting"
  | "weather"
  | "focus"
  | "timer"
  | "time"
  | "math"
  | "joke"
  | "earningSuggestion"
  | "vacuumStart"
  | "vacuumStop"
  | "vacuumReturn"
  | "vacuumStatus"
  | "unknown";

export interface SmartHomeVoiceContext {
  deviceName: string;
  battery: number | null;
  status: "idle" | "cleaning" | "returning" | "charging" | "unknown";
}

export interface ActiveVoiceTimer {
  startedAt: number;
  endsAt: number;
  durationMs: number;
}

export interface VoiceResult {
  text: string;
  action: VoiceAction;
  suggestedProjectId?: string;
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
  const wakeWord = /(?<![а-яё])(?:привет\s+)?колоб(?:ок|ка|ку)(?![а-яё])/;
  const match = wakeWord.exec(normalized);
  if (!match) return null;
  return text.slice(match.index + match[0].length).trim().replace(/^[,!.:\s]+/, "");
}

function parseDuration(text: string): number | null {
  const match = text.toLocaleLowerCase("ru-RU").match(
    /(\d{1,3})\s*(секунд(?:а|у|ы)?|сек|минут(?:а|у|ы)?|мин|час(?:а|ов|ы)?)(?![а-яё])/,
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

function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) {
    const seconds = Math.max(1, Math.round(durationMs / 1000));
    const lastTwoDigits = seconds % 100;
    const lastDigit = seconds % 10;
    const unit =
      lastTwoDigits >= 11 && lastTwoDigits <= 14
        ? "секунд"
        : lastDigit === 1
          ? "секунду"
          : lastDigit >= 2 && lastDigit <= 4
            ? "секунды"
            : "секунд";
    return `${seconds} ${unit}`;
  }

  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  const lastTwoDigits = minutes % 100;
  const lastDigit = minutes % 10;
  const unit =
    lastTwoDigits >= 11 && lastTwoDigits <= 14
      ? "минут"
      : lastDigit === 1
        ? "минуту"
        : lastDigit >= 2 && lastDigit <= 4
          ? "минуты"
          : "минут";
  return `${minutes} ${unit}`;
}

function parseTimerDuration(text: string): number | null {
  const explicitDuration = parseDuration(text);
  if (explicitDuration !== null) return explicitDuration;

  if (!/таймер|напомни\s+через|минут/i.test(text)) return null;
  const match = text.match(/\d+/);
  if (!match) return null;
  const minutes = Number(match[0]);
  return Number.isSafeInteger(minutes) && minutes > 0
    ? minutes * 60_000
    : null;
}

function calculateArithmetic(text: string): number | null {
  const expression = text.match(
    /(?<![\d.,])(?:\d+(?:[.,]\d+)?|[()+*/-])+(?:\s*(?:\d+(?:[.,]\d+)?|[()+*/-])+)*(?![\d.,])/g,
  )?.find((candidate) => /[+*/-]/.test(candidate) && /\d/.test(candidate));
  if (!expression) return null;

  const tokens = expression.match(/\d+(?:[.,]\d+)?|[()+*/-]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s+/g, "")) return null;

  let index = 0;
  const parseFactor = (): number => {
    const token = tokens[index];
    if (token === "+" || token === "-") {
      index += 1;
      const value = parseFactor();
      return token === "-" ? -value : value;
    }
    if (token === "(") {
      index += 1;
      const value = parseExpression();
      if (tokens[index] !== ")") throw new Error("Unbalanced parentheses");
      index += 1;
      return value;
    }
    if (!token || !/^\d/.test(token)) throw new Error("Expected a number");
    index += 1;
    return Number(token.replace(",", "."));
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const operand = parseFactor();
      if (operator === "/" && operand === 0) throw new Error("Division by zero");
      value = operator === "*" ? value * operand : value / operand;
    }
    return value;
  };
  const parseExpression = (): number => {
    let value = parseTerm();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const operand = parseTerm();
      value = operator === "+" ? value + operand : value - operand;
    }
    return value;
  };

  try {
    const result = parseExpression();
    return index === tokens.length && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
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
  const [wakeWordHeard, setWakeWordHeard] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [permissionIssue, setPermissionIssue] = useState(false);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const modeRef = useRef<ListenMode>("off");
  const restartTimerRef = useRef<number | null>(null);
  const commandTimerRef = useRef<number | null>(null);
  const wakeFlashTimerRef = useRef<number | null>(null);
  const productivityReminderRef = useRef<number | null>(null);
  const workTimerRef = useRef<number | null>(null);
  const commandHandlerRef = useRef<
    (result: VoiceResult) => void | Promise<void>
  >(() => {});
  const transcriptHandlerRef = useRef<((text: string) => void) | null>(null);
  const timerHandlerRef = useRef<(timer: ActiveVoiceTimer | null) => void>(() => {});
  const restartWakeListeningRef = useRef<() => void>(() => {});
  const scheduleReminderRef = useRef<() => void>(() => {});
  const activeCommandRef = useRef(false);
  const disposedRef = useRef(false);
  const wakeRequestIdRef = useRef(0);
  const startRetryCountRef = useRef(0);
  const speechRequestRef = useRef(0);
  const smartHomeContextRef = useRef<SmartHomeVoiceContext>({
    deviceName: "Наш робот пылесос",
    battery: null,
    status: "unknown",
  });

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
    const speechRequest = ++speechRequestRef.current;
    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = config.lang ?? "ru-RU";
      utterance.rate = Math.min(rate, 0.96);
      utterance.pitch = Math.max(pitch, 1.06);
      const preferredVoice = getPreferredSpeechVoice(
        window.speechSynthesis.getVoices(),
        utterance.lang,
      );
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.onstart = () => {
        if (speechRequest === speechRequestRef.current) setStatus("speaking");
      };
      utterance.onend = () => {
        if (speechRequest !== speechRequestRef.current) {
          resolve();
          return;
        }
        setStatus("idle");
        resolve();
      };
      utterance.onerror = (event) => {
        if (speechRequest === speechRequestRef.current) setStatus("idle");
        if (event.error === "canceled" || event.error === "interrupted") {
          resolve();
          return;
        }
        reject(new Error("Не удалось озвучить ответ"));
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }, [config.lang]);

  const processCommand = useCallback((text: string): VoiceResult => {
    const normalized = text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
    const { deviceName, battery, status: vacuumStatus } = smartHomeContextRef.current;
    if (/какой заряд|сколько зарядки|сколько заряда|уровень заряд|что с пылесосом|статус пылесоса/i.test(normalized)) {
      const stateDescription =
        vacuumStatus === "cleaning"
          ? "сейчас убирается"
          : vacuumStatus === "returning"
            ? "возвращается на базу"
            : vacuumStatus === "charging"
              ? "заряжается на базе"
              : vacuumStatus === "idle"
                ? "находится на базе"
                : "статус пока неизвестен";
      return {
        text: `У устройства «${deviceName}» ${
          battery === null ? "данные о заряде пока недоступны" : `${battery}% заряда`
        }. Сейчас оно ${stateDescription}.`,
        action: "vacuumStatus",
      };
    }
    if (/уберись|включи (?:робот-?)?пылесос|запусти (?:уборку|пылесос)|начни уборку/i.test(normalized)) {
      return {
        text: `Запускаю «${deviceName}». Пока пылесос работает, открою английский тренажёр и поставлю таймер на 20 минут.`,
        action: "vacuumStart",
      };
    }
    if (/выключи (?:робот-?)?пылесос|останови(?:сь|ть)?|прекрати уборку|стоп пылесос/i.test(normalized)) {
      return {
        text: `Останавливаю «${deviceName}».`,
        action: "vacuumStop",
      };
    }
    if (/верни на базу|на базу|отправь .*пылесос|домой|зарядка/i.test(normalized)) {
      return {
        text: `Отправляю «${deviceName}» на базу. Зарядка начнётся через несколько секунд.`,
        action: "vacuumReturn",
      };
    }
    const freeTimeMatch = normalized.match(
      /(\d{1,3})\s*(?:минут(?:а|ы)?|мин)\s*(?:свободного\s+времени|свободн\w*)?/,
    );
    if (
      freeTimeMatch &&
      (/свободн|есть\s+\d+|могу\s+(?:уделить|выделить)/i.test(normalized))
    ) {
      const availableMinutes = Number(freeTimeMatch[1]);
      const project = findQuickEarningProject(availableMinutes);
      if (project) {
        return {
          text: `Отлично! За ${availableMinutes} минут ты успеешь ${project.quickTaskDescription} в ${project.title}. Открыть?`,
          action: "earningSuggestion",
          suggestedProjectId: project.id,
        };
      }
      return {
        text: `Пока нет задания, которое можно уверенно предложить на ${availableMinutes} минут. Загляни в Магию — там собраны доступные проекты.`,
        action: "earningSuggestion",
      };
    }
    if (/таймер|напомни\s+через/i.test(normalized)) {
      const duration = parseTimerDuration(normalized);
      if (duration === null) {
        return {
          text: "На сколько минут поставить таймер?",
          action: "unknown",
        };
      }
      return {
        text: `Запускаю таймер на ${formatDuration(duration)}. Сфокусируйся на задаче, а я предупрежу, когда время выйдет!`,
        action: "timer",
      };
    }
    const arithmeticResult = calculateArithmetic(normalized);
    if (arithmeticResult !== null) {
      return {
        text: `Ответ: ${arithmeticResult}. Твои математические способности растут!`,
        action: "math",
      };
    }
    if (/который час|сколько времени|время/i.test(normalized)) {
      const currentTime = new Intl.DateTimeFormat("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
      return {
        text: `Сейчас ${currentTime}. Самое время стать лучше на 1%! Чем займемся?`,
        action: "time",
      };
    }
    if (/погода|на улице/i.test(normalized)) {
      return {
        text: "Погоду по геопозиции смотри в карточке «Погода». Если погода подходит, предлагаю выполнить привычку «Прогулка» или заглянуть в Магию дохода!",
        action: "weather",
      };
    }
    if (/шутк|факт/i.test(normalized)) {
      const answers = [
        "Шутка: почему программист не любит природу? Там слишком много багов.",
        "Шутка: программист поставил таймер на 5 минут, а отвлёкся на поиск ошибки. Таймер уже стал историей проекта.",
        "Факт: короткая пауза после сосредоточенной работы помогает вернуться к задаче со свежим взглядом.",
      ];
      return {
        text: answers[Math.floor(Math.random() * answers.length)],
        action: "joke",
      };
    }
    if (/привет|здравствуй|здарова|как дела|как ты|что нового/i.test(normalized)) {
      const streakDays = localHabitsView().habits.reduce(
        (longest, habit) => Math.max(longest, habit.streak),
        0,
      );
      return {
        text: `Привет! Я готов к работе. Твой стрик ${streakDays} ${streakDays === 1 ? "день" : "дней"}. Не хочешь его продлить?`,
        action: "greeting",
      };
    }
    if (/фокус|концентрируйся|учись|учи|английский|хобби|привычк/i.test(normalized)) {
      return {
        text: "Отлично! Давай сосредоточимся на этом деле. Я рядом и помогу держать фокус.",
        action: "focus",
      };
    }
    return {
      text: "Я услышал тебя, но пока не понял команду. Попробуй сказать: «Поставь таймер на 10 минут» или «Какая погода».",
      action: "unknown",
    };
  }, []);

  const executeCommand = useCallback(async (text: string) => {
    const result = processCommand(text);
    await commandHandlerRef.current(result);
    if (result.action === "timer" || result.action === "vacuumStart") {
      const duration =
        result.action === "vacuumStart"
          ? 20 * 60 * 1000
          : parseTimerDuration(text);
      if (duration !== null) {
        clearTimer(workTimerRef);
        const startedAt = Date.now();
        timerHandlerRef.current({
          startedAt,
          endsAt: startedAt + duration,
          durationMs: duration,
        });
        workTimerRef.current = window.setTimeout(() => {
          workTimerRef.current = null;
          timerHandlerRef.current(null);
          if (!disposedRef.current && document.visibilityState === "visible") {
            stopCurrentRecognition(true);
            void speak(
              "Время вышло! Сделай перерыв и загляни в Партнера (Earnings Vault) за промокодом!",
            )
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
    recognition.continuous = requestedMode !== "manual";
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
        const partial = [finalText, interim].filter(Boolean).join(" ");
        const finalCommand = getWakeWordCommand(finalText);
        const command = finalCommand ?? getWakeWordCommand(interim) ?? getWakeWordCommand(partial);
        if (command !== null && !activeCommandRef.current) {
          if (command && finalCommand === null) return;
          activeCommandRef.current = true;
          clearTimer(restartTimerRef);
          clearTimer(wakeFlashTimerRef);
          setWakeWordHeard(true);
          wakeFlashTimerRef.current = window.setTimeout(() => {
            wakeFlashTimerRef.current = null;
            setWakeWordHeard(false);
          }, 1400);
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
        clearTimer(restartTimerRef);
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
        if (transcriptHandlerRef.current) {
          transcriptHandlerRef.current(finalText.trim());
          return;
        }
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
      if (modeRef.current === "command" && requestedMode === "command") {
        clearTimer(restartTimerRef);
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (modeRef.current === "command" && document.visibilityState === "visible") {
            startRecognitionInstance("command");
          }
        }, 300);
        return;
      }
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
      clearTimer(wakeFlashTimerRef);
      setWakeWordHeard(false);
      setIsWakeWordMode(false);
      setIsListening(false);
      setPermissionIssue(false);
      setStatus("idle");
      speechRequestRef.current += 1;
      window.speechSynthesis?.cancel();
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
    clearTimer(wakeFlashTimerRef);
    setWakeWordHeard(false);
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
    clearTimer(wakeFlashTimerRef);
    clearTimer(productivityReminderRef);
    stopCurrentRecognition(true);
    speechRequestRef.current += 1;
    window.speechSynthesis?.cancel();
    playDing();
    setIsWakeWordMode(false);
    setWakeWordHeard(false);
    setIsListening(false);
    setInterimText("");
    setStatus("idle");
  }, [stopCurrentRecognition]);

  const setOnCommandResult = useCallback((handler: (result: VoiceResult) => void | Promise<void>) => {
    commandHandlerRef.current = handler;
  }, []);

  const setOnTranscript = useCallback((handler: ((text: string) => void) | null) => {
    transcriptHandlerRef.current = handler;
  }, []);

  const setOnTimerChange = useCallback(
    (handler: (timer: ActiveVoiceTimer | null) => void) => {
      timerHandlerRef.current = handler;
    },
    [],
  );

  const setSmartHomeContext = useCallback((context: SmartHomeVoiceContext) => {
    smartHomeContextRef.current = context;
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
      clearTimer(wakeFlashTimerRef);
      clearTimer(productivityReminderRef);
      clearTimer(workTimerRef);
      stopCurrentRecognition(true);
      speechRequestRef.current += 1;
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
    wakeWordHeard,
    isListening,
    permissionIssue,
    setWakeWordMode,
    startRecognition,
    stopRecognition,
    speak,
    processCommand,
    runCommand: executeCommand,
    setOnCommandResult,
    setOnTranscript,
    setOnTimerChange,
    setSmartHomeContext,
    clearError,
  };
}
