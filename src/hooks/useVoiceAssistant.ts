import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Типы для статуса голосового ассистента
 */
export type VoiceStatus = "idle" | "listening" | "processing" | "speaking" | "error";

/**
 * Типы для действий после распознавания
 */
export type VoiceAction = "greeting" | "weather" | "focus" | "unknown";

/**
 * Результат обработки команды
 */
export interface VoiceResult {
  text: string;
  action: VoiceAction;
  payload?: any;
}

/**
 * Параметры конфигурации
 */
export interface VoiceConfig {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as WindowWithSpeechRecognition;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

/**
 * Кастомный хук для работы с голосовым ассистентом
 * Использует Web Speech API (STT/TTS)
 */
export function useVoiceAssistant(config: VoiceConfig = {}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const synthesisRef = useRef<typeof window.speechSynthesis>(null);

  // Проверяем поддержку API
  useEffect(() => {
    const SpeechRecognitionAPI = getSpeechRecognitionConstructor();
    setIsSupported(!!SpeechRecognitionAPI && !!window.speechSynthesis);
  }, []);

  // Остановка распознавания
  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setStatus("idle");
    setInterimText("");
    setError(null);
  }, []);

  // Запуск распознавания
  const startRecognition = useCallback(() => {
    if (!isSupported) {
      setError("Голосовой ввод не поддерживается в этом браузере");
      setStatus("error");
      return;
    }

    stopRecognition();

    const SpeechRecognitionAPI = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setError("Голосовой ввод не поддерживается в этом браузере");
      setStatus("error");
      return;
    }
    const recognition = new SpeechRecognitionAPI();

    recognition.lang = config.lang || "ru-RU";
    recognition.continuous = config.continuous !== undefined ? config.continuous : false;
    recognition.interimResults = config.interimResults !== undefined ? config.interimResults : true;

    recognition.onstart = () => setStatus("listening");
    recognition.onend = () => {
      if (status !== "error") setStatus("idle");
    };
    recognition.onerror = (event) => {
      setError(event.error || "Ошибка распознавания");
      setStatus("error");
      stopRecognition();
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setInterimText("");
        setStatus("processing");
      } else {
        setInterimText(interimTranscript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setError(null);
  }, [isSupported, config, status]);

  // Озвучка текста
  const speak = useCallback((text: string, rate: number = 1, pitch: number = 1) => {
    if (!window.speechSynthesis) {
      setError("Синтез речи не поддерживается");
      setStatus("error");
      return Promise.reject("Синтез речи не поддерживается");
    }

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = rate;
      utterance.pitch = pitch;

      // Попробуем найти русский голос
      const voices = window.speechSynthesis.getVoices();
      const russianVoice = voices.find((v) => 
        v.lang.startsWith("ru") && v.name.toLowerCase().includes("male")
      ) || voices.find((v) => v.lang.startsWith("ru"));
      if (russianVoice) {
        utterance.voice = russianVoice;
      }

      utterance.onstart = () => setStatus("speaking");
      utterance.onend = () => {
        setStatus("idle");
        resolve();
      };
      utterance.onerror = (event) => {
        setStatus("idle");
        reject(new Error("Ошибка синтеза речи"));
      };

      // Останавливаем все текущие озвучки
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // Обработка команды (Intent Recognition)
  const processCommand = useCallback((text: string): VoiceResult => {
    const lowerText = text.toLowerCase();

    // Приветствие
    if (/привет|здарова|др|хелло|hi|hello/i.test(lowerText)) {
      return {
        text: "Привет! Погода отличная, готов покорять мир?",
        action: "greeting",
      };
    }

    // Погода
    if (/погода|на улице|дождь|снег|солнце|облачно/i.test(lowerText)) {
      return {
        text: "За окном отличная погода. Идеально для того, чтобы выполнить твою привычку 'Прогулка'.",
        action: "weather",
      };
    }

    // Фокус/задачи
    if (/фокус|концентрируйся|учись|учи|английский|хобби|привычка/i.test(lowerText)) {
      return {
        text: "Отлично! Я отметил это в твоем списке. Давай начнем с 25 минут концентрации!",
        action: "focus",
        payload: { task: "Английский" },
      };
    }

    // Как дела
    if (/как дела|как ты|как Lebens|что нового/i.test(lowerText)) {
      return {
        text: "У меня всё отлично! Готов помочь тебе заработать и стать лучше. Что будем делать?",
        action: "greeting",
      };
    }

    // Помоги/что ты умеешь
    if (/помоги|что ты умеешь|что ты можешь|команды/i.test(lowerText)) {
      return {
        text: "Я умею: проверять погоду, ставить таймеры, добавлять задачи,開く заработок. Спроси что-нибудь!",
        action: "greeting",
      };
    }

    // Fallback
    return {
      text: "Я пока не умею отвечать на сложные вопросы, но я помогу тебе стать лучше на 1% сегодня. Давай поставим таймер на учебу?",
      action: "unknown",
    };
  }, []);

  // Полный цикл: распознавание + обработка + озвучка
  const startVoiceSession = useCallback(async () => {
    if (!isSupported) {
      setError("Голосовой ввод не поддерживается");
      setStatus("error");
      return null;
    }

    startRecognition();

    return new Promise<VoiceResult | null>((resolve) => {
      const checkResult = () => {
        if (status === "processing" && interimText === "") {
          // Finnish, process the final text
          const recognition = recognitionRef.current;
          if (recognition) {
            let finalText = "";
            for (let i = 0; i < recognition.results.length; i++) {
              if (recognition.results[i].isFinal) {
                finalText += recognition.results[i][0].transcript;
              }
            }
            if (finalText) {
              stopRecognition();
              const result = processCommand(finalText);
              resolve(result);
            }
          }
        } else if (status === "idle" && interimText !== "") {
          // Only interim results
          stopRecognition();
          resolve(null);
        } else if (status === "error") {
          stopRecognition();
          resolve(null);
        } else {
          setTimeout(checkResult, 100);
        }
      };
      checkResult();
    });
  }, [isSupported, startRecognition, stopRecognition, status, interimText, processCommand]);

  // Автоматическая обработка при изменении interimText (для continuous mode)
  useEffect(() => {
    if (status === "processing" && interimText === "") {
      const recognition = recognitionRef.current;
      if (recognition) {
        let finalText = "";
        for (let i = 0; i < recognition.results.length; i++) {
          if (recognition.results[i].isFinal) {
            finalText += recognition.results[i][0].transcript;
          }
        }
        if (finalText) {
          stopRecognition();
        }
      }
    }
  }, [interimText, status, stopRecognition]);

  return {
    // Состояние
    status,
    interimText,
    error,
    isSupported,
    
    // Методы
    startRecognition,
    stopRecognition,
    speak,
    processCommand,
    startVoiceSession,
    
    // Утилиты
    isListening: status === "listening",
    isSpeaking: status === "speaking",
    hasError: status === "error",
  };
}
