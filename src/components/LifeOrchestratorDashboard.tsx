/**
 * LifeOrchestratorDashboard — «Грандиозный дашборд» для MVP перед инвестором.
 *
 * Три зоны: Wealth (риск портфеля) | Focus (Колобок и план) | Skills (навыки).
 * Плюс загрузка скриншота портфеля и симуляция умного дома.
 */

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

/* ------------------------------------------------------------------ */
/* Данные для блока Skills (mock курсов и навыков)                     */
/* ------------------------------------------------------------------ */

const SKILLS_POOL = [
  {
    title: "Риск-менеджмент для частных инвесторов",
    source: "Тинькофф Журнал",
    duration: "3 часа",
    when: "высокий риск",
    emoji: "🛡️",
  },
  {
    title: "Психология трейдинга: как не сливать на эмоциях",
    source: "Stepik",
    duration: "5 уроков",
    when: "stress",
    emoji: "🧠",
  },
  {
    title: "Фьючерсы и плечо: инструкция по выживанию",
    source: "Smart-Lab",
    duration: "2 часа",
    when: "futures",
    emoji: "📈",
  },
  {
    title: "Готовка за 20 минут: блюда против стресса",
    source: "Колобок-кухня",
    duration: "15 мин",
    when: "always",
    emoji: "🍳",
  },
  {
    title: "Автоматизация рутины с помощью AI",
    source: "YouTube",
    duration: "40 мин",
    when: "calm",
    emoji: "🤖",
  },
];

function pickSkill(analysis: PortfolioAnalysis | null) {
  const stress = (analysis?.stressScore ?? 0) >= 40;
  const risky = analysis?.riskLevel === "high" || analysis?.riskLevel === "critical";
  const hasFutures = risky;

  const relevant = SKILLS_POOL.filter((s) => {
    if (s.when === "always") return true;
    if (s.when === "stress") return stress;
    if (s.when === "futures") return hasFutures;
    if (s.when === "calm") return !stress && !risky;
    if (s.when === "high risk") return risky;
    return false;
  });

  return relevant[Math.floor(Math.random() * relevant.length)] ?? SKILLS_POOL[3];
}

/* ------------------------------------------------------------------ */
/* Мини-график риска (SVG, без библиотек)                              */
/* ------------------------------------------------------------------ */

function RiskGauge({ stress }: { stress: number }) {
  const angle = (stress / 100) * 180 - 90;
  const color =
    stress > 60 ? "#ff5a5a" : stress > 30 ? "#ffb347" : "#7dff8a";
  return (
    <svg viewBox="0 0 120 70" className="od-gauge">
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7dff8a" />
          <stop offset="50%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#ff5a5a" />
        </linearGradient>
      </defs>
      <path
        d="M10 60 A50 50 0 0 1 110 60"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M10 60 A50 50 0 0 1 110 60"
        stroke="url(#gaugeGrad)"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${(stress / 100) * 157} 157`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <line
        x1="60"
        y1="60"
        x2={60 + 42 * Math.cos((angle * Math.PI) / 180)}
        y2={60 + 42 * Math.sin((angle * Math.PI) / 180)}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        style={{ transition: "all 0.8s ease" }}
      />
      <circle cx="60" cy="60" r="4" fill={color} />
      <text x="60" y="52" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">
        {stress}%
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Главный компонент                                                   */
/* ------------------------------------------------------------------ */

export function LifeOrchestratorDashboard() {
  const [portfolio, setPortfolio] = useState<TinkoffPortfolioData | null>(null);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adviceOpen, setAdviceOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const skill = pickSkill(analysis);

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
    } catch (e) {
      setError("Не удалось распознать скриншот. Попробуй другой.");
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

  return (
    <div className="orchestrator glass">
      {/* ====== ШАПКА ====== */}
      <header className="od-header">
        <div>
          <h2 className="od-title">🧭 Capital-to-Life Orchestrator</h2>
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

      {/* ====== ЗОНА ЗАГРУЗКИ ====== */}
      {!portfolio && (
        <div
          className="od-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
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
            transition={{
              duration: 2,
              repeat: loading ? Infinity : 0,
              ease: "linear",
            }}
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
            Перетащи картинку сюда или нажми. Мы не храним её — только
            анализуем.
          </div>
          {error && <div className="od-drop-err">{error}</div>}
        </div>
      )}

      {/* ====== ТРИ ЗОНЫ ====== */}
      {portfolio && analysis && plan && (
        <div className="od-grid">
          {/* ---------- WEALTH (слева) ---------- */}
          <motion.section
            className="od-zone od-wealth"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="od-zone-title">💰 Wealth</h3>
            <div className="od-balance">
              <div className="od-balance-label">Портфель</div>
              <div className="od-balance-value">
                {portfolio.balance.toLocaleString("ru-RU")} ₽
              </div>
              <div
                className="od-balance-pnl"
                style={{ color: portfolio.pnl >= 0 ? "#7dff8a" : "#ff5a5a" }}
              >
                {portfolio.pnl >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(portfolio.pnl).toLocaleString("ru-RU")} ₽ (
                {portfolio.pnlPercent}%)
              </div>
            </div>

            <RiskGauge stress={analysis.stressScore} />
            <div className="od-risk-label">
              Уровень стресса:{" "}
              <b style={{ color: riskColor }}>
                {analysis.riskLevel.toUpperCase()}
              </b>
            </div>

            {/* Позиции */}
            <div className="od-positions">
              {portfolio.futures.map((f) => (
                <div
                  key={f.ticker}
                  className={`od-pos ${f.marginRisk > 70 ? "danger" : ""}`}
                >
                  <span className="od-pos-ticker">{f.ticker}</span>
                  <span className="od-pos-risk">{f.marginRisk}% маржи</span>
                  <span
                    style={{
                      color: f.currentPnl >= 0 ? "#7dff8a" : "#ff5a5a",
                    }}
                  >
                    {f.currentPnl >= 0 ? "+" : ""}
                    {f.currentPnl}₽
                  </span>
                </div>
              ))}
            </div>

            {/* Кнопка совета */}
            <button
              className="od-advice-btn"
              onClick={() => setAdviceOpen((v) => !v)}
            >
              {adviceOpen ? "Скрыть совет" : "⚡ Совет по фьючерсу"}
            </button>

            <AnimatePresence>
              {adviceOpen && plan.futuresAdvice && (
                <motion.div
                  className={`od-advice-card urgency-${plan.futuresAdvice.urgency}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="od-advice-headline">
                    {plan.futuresAdvice.ticker} →{" "}
                    <b>{plan.futuresAdvice.action}</b>
                  </div>
                  <div className="od-advice-reason">
                    {plan.futuresAdvice.reason}
                  </div>
                  <div className="od-advice-deadline">
                    ⏰ {plan.futuresAdvice.deadline}
                  </div>
                </motion.div>
              )}
              {adviceOpen && !plan.futuresAdvice && (
                <motion.div
                  className="od-advice-card urgency-low"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="od-advice-reason">
                    Всё под контролем — сегодня действий по фьючерсам не нужно.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          {/* ---------- FOCUS (центр) ---------- */}
          <motion.section
            className="od-zone od-focus"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="od-zone-title">🎯 Focus</h3>
            <div className="od-headline">{plan.headline}</div>

            {/* Колобок */}
            <div className="od-kolobok">🫓</div>
            <div className="od-quote">«{plan.kolobokQuote}»</div>

            {/* Еда */}
            <div className="od-meal">
              <div className="od-meal-title">🍽 {plan.meal.dish}</div>
              <div className="od-meal-ing">{plan.meal.ingredients.join(" • ")}</div>
              <div className="od-meal-benefit">{plan.meal.benefit}</div>
            </div>

            {/* Привычка */}
            <div className="od-habit">
              <span className="od-habit-ico">{plan.habit.icon}</span>
              <div>
                <div className="od-habit-title">{plan.habit.title}</div>
                <div className="od-habit-reason">{plan.habit.reason}</div>
              </div>
              {plan.habit.streakBoost && (
                <span className="od-habit-streak">🔥 +стрик</span>
              )}
            </div>

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

          {/* ---------- SKILLS (справа) ---------- */}
          <motion.section
            className="od-zone od-skills"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="od-zone-title">🚀 Skills</h3>
            <div className="od-skill-card">
              <div className="od-skill-emoji">{skill.emoji}</div>
              <div className="od-skill-title">{skill.title}</div>
              <div className="od-skill-src">{skill.source}</div>
              <div className="od-skill-dur">⏱ {skill.duration}</div>
              <button className="od-skill-btn">Начать обучение</button>
            </div>

            {/* Рекомендации движка */}
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
                <span>
                  {plan.smartHomeMood.lighting.brightness}% яркость
                </span>
              </div>
            </div>
          </motion.section>
        </div>
      )}

      {/* ====== ФУТЕР ====== */}
      <footer className="od-footer">
        💡 MVP-режим: распознавание скриншота — заглушка. В проде подключим
        OCR + Тинькофф InvestAPI и HA-мост для умного дома.
      </footer>
    </div>
  );
}
