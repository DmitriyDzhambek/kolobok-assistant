import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Headphones, X } from "lucide-react";
import { tgWebApp } from "../tma";

type Word = {
  word: string;
  transcription: string;
  translation: string;
};

const WORDS: Word[] = [
  { word: "Focus", transcription: "/ˈfoʊkəs/", translation: "сосредоточенность" },
  { word: "Habit", transcription: "/ˈhæbɪt/", translation: "привычка" },
  { word: "Earn", transcription: "/ɜːrn/", translation: "зарабатывать" },
  { word: "Goal", transcription: "/ɡoʊl/", translation: "цель" },
  { word: "Progress", transcription: "/ˈprɑːɡres/", translation: "прогресс" },
];

type EnglishModalProps = {
  isOpen: boolean;
  crystals: number;
  onClose: () => void;
  onLearned: () => void;
};

function openLearningPartner(url: string) {
  const telegram = tgWebApp();
  if (telegram?.openLink) telegram.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

export function EnglishModal({
  isOpen,
  crystals,
  onClose,
  onLearned,
}: EnglishModalProps) {
  const [wordIndex, setWordIndex] = useState(
    () => Math.floor(Math.random() * WORDS.length),
  );
  const [speechError, setSpeechError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.speechSynthesis?.cancel();
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;
  const word = WORDS[wordIndex];

  const speakWord = () => {
    if (!("speechSynthesis" in window)) {
      setSpeechError("Озвучивание не поддерживается в этом браузере.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.word);
    utterance.lang = "en-US";
    utterance.onerror = () => setSpeechError("Не удалось воспроизвести слово.");
    setSpeechError("");
    window.speechSynthesis.speak(utterance);
  };

  const learnWord = () => {
    onLearned();
    setWordIndex((current) => (current + 1) % WORDS.length);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="learning-overlay"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.section
          className="learning-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="english-modal-title"
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="learning-close"
            onClick={onClose}
            aria-label="Закрыть тренажёр"
          >
            <X size={20} />
          </button>
          <span className="learning-eyebrow">
            <BookOpen size={16} aria-hidden="true" />
            МИКРОУРОК · +10 КРИСТАЛЛОВ
          </span>
          <h2 id="english-modal-title">Фокус дня: Английский</h2>
          <motion.div
            className="english-word-card"
            key={word.word}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <strong>{word.word}</strong>
            <span className="english-transcription">{word.transcription}</span>
            <span className="english-translation">{word.translation}</span>
          </motion.div>
          <div className="english-crystals" aria-live="polite">
            💎 Кристаллы: {crystals}
          </div>
          {speechError && <p className="english-speech-error" role="status">{speechError}</p>}
          <div className="learning-actions">
            <button type="button" className="learning-listen" onClick={speakWord}>
              <Headphones size={18} aria-hidden="true" />
              Прослушать
            </button>
            <button type="button" className="learning-complete" onClick={learnWord}>
              <Check size={18} aria-hidden="true" />
              Я выучил · +10
            </button>
          </div>
          <div className="english-partner-links">
            <span>Учить глубже:</span>
            <button
              type="button"
              className="english-partner-link"
              onClick={() => openLearningPartner("https://www.duolingo.com/")}
            >
              Duolingo
            </button>
            <button
              type="button"
              className="english-partner-link"
              onClick={() => openLearningPartner("https://puzzle-english.com/")}
            >
              Puzzle English
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

export default EnglishModal;
