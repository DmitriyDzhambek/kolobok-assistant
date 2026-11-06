import { useCallback, useEffect, useRef, useState } from "react";
import { getPreferredSpeechVoice } from "../speech/preferredVoice";

export type DialogueTab = "main" | "magic" | "partner" | "dreams";

export interface UseKolobokDialogueOptions {
  activeTab: DialogueTab;
  isVoiceActive: boolean;
}

export const randomTips = [
  "Проверь, появились ли новые задания в Money Bux.",
  "Твоя копилка ждёт следующего пополнения — загляни в свои цели.",
  "Небольшой перерыв и стакан воды тоже помогают держать фокус.",
  "Если есть несколько свободных минут, можно выбрать короткое задание в Магии дохода.",
];

const MORNING_GREETING_KEY = "kolobok.morning-crypto-greeting.v1";

type CoinGeckoTonResponse = {
  "the-open-network"?: {
    rub?: number;
  };
};

function isMorning(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 6 && hour < 12;
}

function getTodayKey(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function hasMorningGreetingToday(): boolean {
  try {
    return window.localStorage.getItem(MORNING_GREETING_KEY) === getTodayKey();
  } catch (storageError) {
    console.error("Не удалось проверить утреннее приветствие:", storageError);
    return false;
  }
}

function markMorningGreetingShown(): void {
  try {
    window.localStorage.setItem(MORNING_GREETING_KEY, getTodayKey());
  } catch (storageError) {
    console.error("Не удалось сохранить дату утреннего приветствия:", storageError);
  }
}

export async function fetchTonRate(): Promise<number | null> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=rub",
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`CoinGecko вернул ошибку ${response.status}`);
    }

    const data: CoinGeckoTonResponse = await response.json();
    const rate = data["the-open-network"]?.rub;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("CoinGecko вернул некорректный курс TON");
    }
    return rate;
  } catch (error) {
    console.error("Ошибка API курса TON:", error);
    return null;
  }
}

export async function generateMorningGreeting(): Promise<string | null> {
  const rate = await fetchTonRate();
  if (rate === null) {
    return "Доброе утро! Не удалось проверить курс TON, но это не повод грустить. Твоя копилка ждёт пополнения. Начнём?";
  }

  const formattedRate = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(rate);
  return `Доброе утро! Пока ты просыпаешься, я проверил курсы. TON сейчас стоит ${formattedRate} рублей. Отличный повод начать день с заработка. Готов?`;
}

export function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) {
    return "Доброе утро! Готов покорять мир? Давай посмотрим твои задачи на сегодня.";
  }
  if (hour >= 12 && hour < 18) {
    return "Добрый день! Как проходит день? Не забыл про свои привычки?";
  }
  if (hour >= 18 && hour < 23) {
    return "Добрый вечер! Самое время подвести итоги и заглянуть в Магию Заработка.";
  }
  return "Ого, уже поздно. Может, отдохнёшь? А я пока посторожу твою копилку.";
}

interface UseKolobokDialogueResult {
  currentPhrase: string;
  setCurrentPhrase: (phrase: string) => void;
  isTyping: boolean;
  isSleeping: boolean;
  isSpeaking: boolean;
  notifyActivity: (suppressGreeting?: boolean) => void;
}

export function useKolobokDialogue({
  activeTab,
  isVoiceActive,
}: UseKolobokDialogueOptions): UseKolobokDialogueResult {
  const [currentPhrase, setPhraseState] = useState(getGreeting);
  const [isTyping, setIsTyping] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activityRevision, setActivityRevision] = useState(0);
  const [greetingRevision, setGreetingRevision] = useState(0);
  const isSleepingRef = useRef(false);
  const isVoiceActiveRef = useRef(isVoiceActive);
  const internalSpeechRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const pendingGreetingRef = useRef(false);
  const speechRequestRef = useRef(0);
  const hasGreetedRef = useRef(false);
  const previousTabRef = useRef(activeTab);
  const lastActivityRef = useRef(Date.now());
  const wasVoiceActiveRef = useRef(false);
  const contextTriggerRef = useRef("");
  const randomTipTriggerRef = useRef(0);
  const boredomTriggerRef = useRef(0);
  const sleepTriggerRef = useRef(0);
  const sleepDeadlineRef = useRef<number | null>(null);
  const morningGreetingPendingRef = useRef(
    typeof window !== "undefined" && isMorning() && !hasMorningGreetingToday(),
  );
  const morningGreetingRef = useRef<string | null>(null);
  const morningGreetingPromiseRef = useRef<Promise<string | null> | null>(null);
  isVoiceActiveRef.current = isVoiceActive;

  const stopSpeech = useCallback(() => {
    speechRequestRef.current += 1;
    internalSpeechRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakPhrase = useCallback((text: string, fromUserGesture = false) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      if (!fromUserGesture) pendingGreetingRef.current = true;
      return;
    }

    if (
      isVoiceActiveRef.current &&
      !internalSpeechRef.current
    ) {
      return;
    }

    const requestId = speechRequestRef.current + 1;
    speechRequestRef.current = requestId;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ru-RU";
    utterance.rate = 0.96;
    utterance.pitch = 1.06;
    const preferredVoice = getPreferredSpeechVoice(
      window.speechSynthesis.getVoices(),
      utterance.lang,
    );
    if (preferredVoice) utterance.voice = preferredVoice;
    let didStart = false;
    utterance.onstart = () => {
      if (speechRequestRef.current !== requestId) return;
      didStart = true;
      internalSpeechRef.current = true;
      pendingGreetingRef.current = false;
      setIsSpeaking(true);
    };
    utterance.onend = () => {
      if (speechRequestRef.current !== requestId) return;
      internalSpeechRef.current = false;
      setIsSpeaking(false);
    };
    utterance.onerror = (event) => {
      if (speechRequestRef.current !== requestId || event.error === "canceled") return;
      internalSpeechRef.current = false;
      setIsSpeaking(false);
      if (!didStart && !fromUserGesture) pendingGreetingRef.current = true;
      console.info("Не удалось озвучить проактивную фразу:", event.error);
    };

    try {
      window.speechSynthesis.speak(utterance);
      if (!fromUserGesture) {
        window.setTimeout(() => {
          if (
            speechRequestRef.current === requestId &&
            !didStart &&
            !window.speechSynthesis.speaking
          ) {
            pendingGreetingRef.current = true;
          }
        }, 2500);
      }
    } catch (speechError) {
      if (!fromUserGesture) pendingGreetingRef.current = true;
      console.info("Браузер заблокировал проактивную озвучку:", speechError);
    }
  }, []);

  const publishPhrase = useCallback((phrase: string, shouldSpeak = true) => {
    setPhraseState(phrase);
    if (shouldSpeak && (audioUnlockedRef.current || hasGreetedRef.current)) {
      speakPhrase(phrase);
    }
  }, [speakPhrase]);

  const setCurrentPhrase = useCallback((phrase: string) => {
    publishPhrase(phrase, false);
  }, [publishPhrase]);

  const notifyActivity = useCallback((suppressGreeting = false) => {
    audioUnlockedRef.current = true;
    lastActivityRef.current = Date.now();
    sleepDeadlineRef.current = null;
    if (isSleepingRef.current) {
      isSleepingRef.current = false;
      setIsSleeping(false);
      setPhraseState("Я снова на связи! Чем займёмся?");
    }
    if (
      morningGreetingPendingRef.current &&
      !suppressGreeting &&
      !isVoiceActiveRef.current
    ) {
      morningGreetingPendingRef.current = false;
      hasGreetedRef.current = true;
      stopSpeech();
      const greeting = morningGreetingRef.current;
      if (greeting) {
        setPhraseState(greeting);
        setIsTyping(false);
        markMorningGreetingShown();
        speakPhrase(greeting, true);
      } else {
        setIsTyping(true);
        setPhraseState("Доброе утро! Проверяю актуальный курс TON…");
        speakPhrase("Доброе утро! Проверяю актуальный курс TON.", true);
        const greetingPromise =
          morningGreetingPromiseRef.current ?? generateMorningGreeting();
        morningGreetingPromiseRef.current = greetingPromise;
        void greetingPromise.then((resolvedGreeting) => {
          if (!resolvedGreeting) return;
          morningGreetingRef.current = resolvedGreeting;
          setPhraseState(resolvedGreeting);
          setIsTyping(false);
          markMorningGreetingShown();
          if (!isVoiceActiveRef.current) speakPhrase(resolvedGreeting, true);
        });
      }
      setActivityRevision((revision) => revision + 1);
      return;
    }
    if (
      pendingGreetingRef.current &&
      !isVoiceActiveRef.current &&
      !suppressGreeting
    ) {
      pendingGreetingRef.current = false;
      hasGreetedRef.current = true;
      speakPhrase(getGreeting(), true);
    } else {
      stopSpeech();
    }
    setActivityRevision((revision) => revision + 1);
  }, [speakPhrase, stopSpeech]);

  useEffect(() => {
    isVoiceActiveRef.current = isVoiceActive;
    if (isVoiceActive) stopSpeech();
  }, [isVoiceActive, stopSpeech]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleDocumentClick = (event: MouseEvent) => {
      audioUnlockedRef.current = true;
      const target = event.target;
      const isVoiceControl =
        target instanceof Element &&
        Boolean(target.closest(".home-mic-button, .wake-word-toggle, .voice-fallback-form"));
      notifyActivity(isVoiceControl);
    };
    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [notifyActivity, speakPhrase]);

  useEffect(() => {
    if (!morningGreetingPendingRef.current) return;
    setPhraseState("Доброе утро! Проверяю актуальный курс TON…");
    setIsTyping(true);
    const greetingPromise =
      morningGreetingPromiseRef.current ?? generateMorningGreeting();
    morningGreetingPromiseRef.current = greetingPromise;
    let active = true;
    void greetingPromise.then((greeting) => {
      if (!active || !greeting) return;
      morningGreetingRef.current = greeting;
      setPhraseState(greeting);
      setIsTyping(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hasGreetedRef.current) return;
    if (morningGreetingPendingRef.current) return;
    const timer = window.setTimeout(() => {
      hasGreetedRef.current = true;
      const greeting = getGreeting();
      publishPhrase(greeting);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [publishPhrase, speakPhrase]);

  useEffect(() => {
    if (previousTabRef.current === activeTab) return;
    const wasAwayFromHome = previousTabRef.current !== "main";
    previousTabRef.current = activeTab;
    lastActivityRef.current = Date.now();
    sleepDeadlineRef.current = null;
    setActivityRevision((revision) => revision + 1);
    if (activeTab !== "main" || !wasAwayFromHome) return;

    const timer = window.setTimeout(() => {
      publishPhrase(getGreeting());
      setGreetingRevision((revision) => revision + 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [activeTab, publishPhrase]);

  useEffect(() => {
    if (isVoiceActive) {
      wasVoiceActiveRef.current = true;
      lastActivityRef.current = Date.now();
      return;
    }
    if (wasVoiceActiveRef.current) {
      wasVoiceActiveRef.current = false;
      lastActivityRef.current = Date.now();
      setActivityRevision((revision) => revision + 1);
    }
  }, [isVoiceActive]);

  useEffect(() => {
    if (typeof document === "undefined" || document.visibilityState === "hidden") return;
    if (isVoiceActive || internalSpeechRef.current) return;

    const activityAtSchedule = lastActivityRef.current;
    const stillIdle = () =>
      !isVoiceActiveRef.current &&
      !internalSpeechRef.current &&
      !isSleepingRef.current &&
      lastActivityRef.current === activityAtSchedule &&
      document.visibilityState === "visible";
    const timers: number[] = [];
    const elapsed = Date.now() - activityAtSchedule;
    const scheduleAt = (deadlineMs: number, callback: () => void) => {
      timers.push(window.setTimeout(callback, Math.max(0, deadlineMs - elapsed)));
    };

    let contextPhrase: string | null = null;
    let contextDelay = 0;
    if (activeTab === "main") {
      contextDelay = 20_000;
      contextPhrase =
        "Кстати, я посчитал: если выполнить ещё три задания, баланс копилки увеличится на сумму их наград.";
    } else if (activeTab === "magic") {
      contextDelay = 15_000;
      contextPhrase = "Выбирай проект — я помогу тебе пройти шаги Авто-Пилота.";
    }

    const tipIndex = Math.floor(Math.random() * randomTips.length);
    if (randomTipTriggerRef.current !== activityAtSchedule) {
      scheduleAt(30_000, () => {
        if (!stillIdle() || randomTipTriggerRef.current === activityAtSchedule) return;
        randomTipTriggerRef.current = activityAtSchedule;
        publishPhrase(randomTips[tipIndex]);
      });
    }

    const contextKey = `${activeTab}:${activityAtSchedule}`;
    if (contextPhrase && contextTriggerRef.current !== contextKey) {
      scheduleAt(contextDelay, () => {
        if (!stillIdle() || contextTriggerRef.current === contextKey) return;
        contextTriggerRef.current = contextKey;
        publishPhrase(contextPhrase);
      });
    }

    if (boredomTriggerRef.current !== activityAtSchedule) {
      scheduleAt(45_000, () => {
        if (!stillIdle() || boredomTriggerRef.current === activityAtSchedule) return;
        boredomTriggerRef.current = activityAtSchedule;
        sleepDeadlineRef.current = Date.now() + 30_000;
        publishPhrase("Эй, ты тут? Я скучаю...");
      });
    }

    if (boredomTriggerRef.current === activityAtSchedule && sleepDeadlineRef.current) {
      scheduleAt(Math.max(45_000, sleepDeadlineRef.current - activityAtSchedule), () => {
        if (!stillIdle() || sleepTriggerRef.current === activityAtSchedule) return;
        sleepTriggerRef.current = activityAtSchedule;
        isSleepingRef.current = true;
        setIsSleeping(true);
        publishPhrase("Тсс... Я вздремну. Позови, если понадоблюсь", false);
      });
    }

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [
    activeTab,
    activityRevision,
    greetingRevision,
    isVoiceActive,
    isSpeaking,
    publishPhrase,
  ]);

  useEffect(() => {
    const updateSpeakingState = () => {
      const speaking = "speechSynthesis" in window && window.speechSynthesis.speaking;
      setIsSpeaking((current) => current === speaking ? current : speaking);
    };
    updateSpeakingState();
    const interval = window.setInterval(updateSpeakingState, 300);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopSpeech();
        lastActivityRef.current = Date.now();
        setActivityRevision((revision) => revision + 1);
      } else {
        lastActivityRef.current = Date.now();
        setActivityRevision((revision) => revision + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [stopSpeech]);

  return {
    currentPhrase,
    setCurrentPhrase,
    isTyping,
    isSleeping,
    isSpeaking,
    notifyActivity,
  };
}

export default useKolobokDialogue;
