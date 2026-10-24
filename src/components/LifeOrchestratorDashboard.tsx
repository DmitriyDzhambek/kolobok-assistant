/**
 * LifeOrchestratorDashboard — «Грандиозный дашборд» для MVP перед инвестором.
 *
 * Три зоны: Wealth (Богатство) | Life (Жизнь) | Skills (Навыки).
 * После загрузки скриншота или нажатия «Демо-режим» для инвестора,
 * «Магический портал» исчезает, и на его месте плавно появляется дашборд.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Coffee, Brain, GraduationCap,
  ChevronRight, Play, CheckCircle, XCircle, Sparkles
} from "lucide-react";

import {
  parsePortfolioScreenshot,
  analyzePortfolioRisk,
  type TinkoffPortfolioData,
  type PortfolioAnalysis,
} from "../modules/portfolio/parser";
import {
  generateDailyPlan,
  setMood,
  type DailyPlan,
} from "../modules/riskEngine/engine";
import {
  WealthBlock,
  type WealthScenario,
  SCENARIO_LABELS,
} from "./WealthBlock";

/* ─────────────────────── данные для квиза ─────────────────────── */

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "Что происходит с фьючерсом в день экспирации?",
    options: [
      "Цена фиксируется — позиция закрывается или переносится",
      "Торги удорожаются в 10 раз",
      "Фьючерс автоматически сгорает",
    ],
    correct: 0,
    explanation:
      "Верно! В день экспирации цена фьючерса сходится с ценой базового актива. Позиции либо закрываются, либо переносятся на следующий контракт.",
  },
  {
    question: "Что такое гарантийное обеспечение (ГО)?",
    options: [
      "Комиссия брокера за сделку",
      "Залог для открытия фьючерсной позиции",
      "Награда за прибыльную сделку",
    ],
    correct: 1,
    explanation:
      "Точно! ГО — это залог, который блокируется на счёте для открытия фьючерсной позиции. Обычно составляет 5–20% от стоимости контракта.",
  },
  {
    question: "Что такое экспирация?",
    options: [
      "Начало торгов фьючерсом",
      "Дата окончания срока жизни контракта",
      "Увеличение волатильности",
    ],
    correct: 1,
    explanation:
      "Правильно! Экспирация — дата, когда фьючерсный контракт перестает существовать и позиция должна быть закрыта или перенесена.",
  },
];

/* ─────────────────────── Главный компонент ─────────────────────── */

export function LifeOrchestratorDashboard() {
  const [portfolio, setPortfolio] = useState<TinkoffPortfolioData | null>(null);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalVisible, setPortalVisible] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [scenario, setScenario] = useState<WealthScenario>("profit");

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState<number | null>(null);
  const [quizCorrect, setQuizCorrect] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  // Life-блок зависит от сценария Wealth
  const isProfit = scenario === "profit" || scenario === "tax";

  const skill = useMemo(() => {
    if (!analysis) return null;
    const stress = analysis.stressScore >= 40;
    const risky = analysis.riskLevel === "high" || analysis.riskLevel === "critical";
    const pools = [
      { title: "Риск-менеджмент для частных инвесторов", source: "Тинькофф Журнал", duration: "3 часа", emoji: "🛡️" },
      { title: "Психология трейдинга: как не сливать на эмоциях", source: "Stepik", duration: "5 уроков", emoji: "🧠" },
      { title: "Фьючерсы и плечо: инструкция по выживанию", source: "Smart-Lab", duration: "2 часа", emoji: "📈" },
      { title: "Готовка за 20 минут: блюда против стресса", source: "Колобок-кухня", duration: "15 мин", emoji: "🍳" },
      { title: "Автоматизация рутины с помощью AI", source: "YouTube", duration: "40 мин", emoji: "🤖" },
    ];
    const relevant = pools.filter((s) => {
      if (stress && risky) return true;
      if (stress) return s.title.includes("Психология") || s.title.includes("Риск");
      if (risky) return s.title.includes("Фьючерсы");
      return s.title.includes("Готовка") || s.title.includes("Автоматизация");
    });
    return relevant[0] ?? pools[0];
  }, [analysis]);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const data = await parsePortfolioScreenshot(file);
      const an = analyzePortfolioRisk(data);
      const dailyPlan = generateDailyPlan(data, an);
      setPortfolio(data);
      setAnalysis(an);
      setPlan(dailyPlan);
      setMood(dailyPlan.smartHomeMood);
      setPortalVisible(false);
    } catch {
      setError("Не удалось распознать скриншот. Попробуй другой.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Имитируем скриншот-загрузку
      const fakeFile = new File([""], "demo.png");
      const data = await parsePortfolioScreenshot(fakeFile);
      const an = analyzePortfolioRisk(data);
      const dailyPlan = generateDailyPlan(data, an);
      setPortfolio(data);
      setAnalysis(an);
      setPlan(dailyPlan);
      setMood(dailyPlan.smartHomeMood);
      setDemoMode(true);
      setPortalVisible(false);
    } catch {
      setError("Не удалось загрузить демо-данные.");
    } finally {
      setLoading(false);
    }
  }, []);

  const riskColor =
    analysis?.riskLevel === "critical" || analysis?.riskLevel === "high"
      ? "#ff5a5a"
      : analysis?.riskLevel === "medium"
        ? "#ffb347"
        : "#7dff8a";

  const handleQuizAnswer = (idx: number) => {
    if (quizAnswered !== null) return;
    setQuizAnswered(idx);
    if (idx === QUIZ_QUESTIONS[quizIndex].correct) {
      setQuizCorrect((c) => c + 1);
    }
  };

  const handleNextQuiz = () => {
    setQuizAnswered(null);
    setQuizIndex((i) => Math.min(i + 1, QUIZ_QUESTIONS.length - 1));
  };

  const currentQuiz = QUIZ_QUESTIONS[quizIndex];

  return (
    <div className="orchestrator glass">
      {/* ═══════ ШАПКА ═══════ */}
      <header className="od-header">
        <div>
          <h2 className="od-title">
            <Sparkles className="inline w-5 h-5 mr-2 text-yellow-400" />
            Life Orchestrator
          </h2>
          <div className="od-sub">
            Твой портфель управляет днём — Колобок связывает деньги, еду,
            привычки и дом в один план
          </div>
        </div>
        <div className="od-mood-chip" style={{ borderColor: riskColor }}>
          <span className="od-mood-dot" style={{ background: riskColor }} />
          {plan ? plan.smartHomeMood.mode.toUpperCase() : "ОЖИДАНИЕ"}
        </div>
      </header>

      {/* ═══════ МАГИЧЕСКИЙ ПОРТАЛ ═══════ */}
      <AnimatePresence>
        {portalVisible && (
          <motion.div
            className="magic-portal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div
              className="od-drop portal-drop"
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255, 215, 102, 0.8)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 30px rgba(255, 215, 102, 0.3)";
              }}
              onDragLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "";
              }}
              onDrop={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).style.borderColor = "";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <motion.div
                animate={{ rotate: loading ? 360 : 0 }}
                transition={{ duration: 2, repeat: loading ? Infinity : 0, ease: "linear" }}
                className="od-drop-ico"
              >
                {loading ? "⏳" : "📸"}
              </motion.div>
              <div className="od-drop-title">
                {loading
                  ? "Колобок рассматривает твой портфель…"
                  : "Загрузи утренний скриншот из Тинькофф Инвестиций"}
              </div>
              <div className="od-drop-hint">
                Перетащи картинку сюда или нажми. Мы не храним её — только анализуем.
              </div>
              <div className="portal-demo">
                <span className="portal-hint">или</span>
                <button className="portal-demo-btn" onClick={(e) => { e.stopPropagation(); handleDemo(); }}>
                  <Play className="w-4 h-4 mr-1" />
                  Демо-режим
                </button>
              </div>
              {error && <div className="od-drop-err">{error}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ ДАШБОРД ═══════ */}
      <AnimatePresence>
        {portalVisible ? null : portfolio && analysis && plan && (
          <motion.div
            className="od-grid"
            initial={{ opacity: 0, y: 40, rotateX: 15 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* ──────────────── БЛОК 1: WEALTH ──────────────── */}
            <WealthBlock
              portfolio={portfolio}
              analysis={analysis}
              scenario={scenario}
              onScenarioChange={setScenario}
              demoMode={demoMode}
              futuresAdvice={plan.futuresAdvice}
            />

            {/* ──────────────── БЛОК 2: LIFE (центр) ──────────────── */}
            <motion.section
              className="od-zone od-focus od-life"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="od-zone-header">
                <Heart className={`w-5 h-5 ${isProfit ? "text-pink-400" : "text-blue-400"}`} />
                <h3 className="od-zone-title">Life Balance</h3>
              </div>

              {/* Индикация сценария (переключатель — в блоке Wealth) */}
              {demoMode && (
                <div className="od-scenario-hint">
                  Сценарий: <b>{SCENARIO_LABELS[scenario]}</b>
                  <span className="od-scenario-arrow">← переключается в блоке Wealth</span>
                </div>
              )}

              {/* Колобок */}
              <motion.div
                className="od-kolobok"
                key={isProfit ? "profit" : "loss"}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {isProfit ? "🫓" : "😔"}
              </motion.div>

              {/* Текст от Колобка */}
              <motion.div
                key={isProfit ? "profit-text" : "loss-text"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {isProfit ? (
                  <div className="od-life-card od-life-profit">
                    <Coffee className="w-5 h-5 mb-2 text-yellow-400" />
                    <p className="od-life-text">
                      Твой портфель в плюсе! Отличный повод побаловать себя.
                      Я подобрал рецепт <strong>{plan.meal.dish}</strong> —
                      всего {plan.meal.ingredients.length} ингредиента, {plan.meal.benefit.toLowerCase()}.
                    </p>
                    <div className="od-meal-tags">
                      {plan.meal.ingredients.slice(0, 3).map((ing, i) => (
                        <span key={i} className="od-meal-tag">{ing}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="od-life-card od-life-loss">
                    <Heart className="w-5 h-5 mb-2 text-blue-400" />
                    <p className="od-life-text">
                      Рынок сегодня штормит. Не паникуй. Я включил белый шум
                      на 10 минут. Завари ромашковый чай и сделай дыхательную
                      гимнастику. Завтра будет лучше.
                    </p>
                    <div className="od-habit">
                      <span className="od-habit-ico">🫖</span>
                      <div>
                        <div className="od-habit-title">{plan.habit.title}</div>
                        <div className="od-habit-reason">{plan.habit.reason}</div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Таймлайн */}
              <div className="od-timeline">
                {plan.calendar.map((b, i) => (
                  <div key={i} className={`od-block type-${b.type}`}>
                    <span className="od-time">{b.time}</span>
                    <span className="od-bico">{b.icon}</span>
                    <div className="od-btext">
                      <div>{b.title}</div>
                      {b.reason && (
                        <small className="od-breason">{b.reason}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* ──────────────── БЛОК 3: SKILLS ──────────────── */}
            <motion.section
              className="od-zone od-skills"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <div className="od-zone-header">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="od-zone-title">Micro-Learning</h3>
              </div>

              {/* Мини-тест */}
              <div className="od-quiz">
                <div className="od-quiz-progress">
                  <span>
                    Вопрос {quizIndex + 1}/{QUIZ_QUESTIONS.length}
                  </span>
                  <span className="od-quiz-score">
                    ✦ {quizCorrect}
                  </span>
                </div>
                <p className="od-quiz-question">{currentQuiz.question}</p>
                <div className="od-quiz-options">
                  {currentQuiz.options.map((opt, idx) => {
                    let btnClass = "od-quiz-opt";
                    if (quizAnswered !== null) {
                      if (idx === currentQuiz.correct) {
                        btnClass += " od-quiz-correct";
                      } else if (idx === quizAnswered && idx !== currentQuiz.correct) {
                        btnClass += " od-quiz-wrong";
                      }
                    }
                    return (
                      <button
                        key={idx}
                        className={btnClass}
                        onClick={() => handleQuizAnswer(idx)}
                        disabled={quizAnswered !== null}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {quizAnswered !== null && (
                    <motion.div
                      className="od-quiz-result"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {quizAnswered === currentQuiz.correct ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <p>{currentQuiz.explanation}</p>
                          <small className="od-quiz-bonus">
                            Отлично! +10 к уровню твоего финансового IQ 🧠
                          </small>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-400" />
                          <p>{currentQuiz.explanation}</p>
                        </>
                      )}
                      {quizIndex < QUIZ_QUESTIONS.length - 1 && (
                        <button className="od-quiz-next" onClick={handleNextQuiz}>
                          Следующий вопрос
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Рекомендованный курс (подбирается по уровню стресса) */}
              {skill && (
                <div className="od-skill-card">
                  <div className="od-skill-emoji">{skill.emoji}</div>
                  <div className="od-skill-title">{skill.title}</div>
                  <div className="od-skill-src">
                    <GraduationCap className="inline w-3.5 h-3.5 mr-1" />
                    {skill.source} · {skill.duration}
                  </div>
                </div>
              )}

              {/* Рекомендации */}
              <div className="od-reco">
                <div className="od-reco-title">От Колобка:</div>
                <ul>
                  {analysis.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* Умный дом */}
              <div
                className="od-smart-home"
                style={{
                  background: `linear-gradient(135deg, ${plan.smartHomeMood.lighting.color}22, transparent)`,
                }}
              >
                <div className="od-sh-title">🏠 Умный дом</div>
                <div className="od-sh-desc">{plan.smartHomeMood.description}</div>
                <div className="od-sh-lights">
                  <div
                    className="od-sh-bulb"
                    style={{
                      background: plan.smartHomeMood.lighting.color,
                      boxShadow: `0 0 ${plan.smartHomeMood.lighting.brightness / 2}px ${plan.smartHomeMood.lighting.color}`,
                      opacity: plan.smartHomeMood.lighting.brightness / 100,
                    }}
                  />
                  <span>{plan.smartHomeMood.lighting.brightness}% яркость</span>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ ФУТЕР ═══════ */}
      <footer className="od-footer">
        💡 MVP-режим: распознавание скриншота — заглушка. В проде подключим
        OCR + Тинькофф InvestAPI и HA-мост для умного дома.
      </footer>
    </div>
  );
}

