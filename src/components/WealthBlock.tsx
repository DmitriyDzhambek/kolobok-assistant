/**
 * WealthBlock — «Wealth & Risk» карточка с тремя умными виджетами.
 *
 * Advisory Mode: Колобок НЕ торгует за пользователя. Только текстовые
 * советы, которые пользователь сам выполнит в своём брокерском приложении.
 *
 * Три виджета:
 *   1. Налоговый щит (ЛДВ, ст. 219.1 НК РФ)
 *   2. Торговый календарь MOEX (статус биржи + совет)
 *   3. Спасение от паники (поведенческий стоп)
 *
 * Демо-селектор сценариев для питча перед инвестором.
 */

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Shield, ShieldCheck, Hourglass, Clock, Umbrella, Landmark,
	TrendingUp, TrendingDown, Percent, Sparkles, Lock, Wind, Activity
} from "lucide-react";

import type { TinkoffPortfolioData, PortfolioAnalysis } from "../modules/portfolio/parser";
import { findTaxTrap, type TaxShieldResult } from "../modules/advisory/taxShield";
import { getMarketStatus, type MarketInfo } from "../modules/advisory/marketCalendar";
import { analyzePanicRisk, type BehavioralShieldResult } from "../modules/advisory/behavioralShield";
import { RelaxAudio } from "../modules/advisory/relaxAudio";

/* ─────────────────────── демо-сценарии ─────────────────────── */

export type WealthScenario = "profit" | "loss" | "closed" | "tax";

export const SCENARIO_LABELS: Record<WealthScenario, string> = {
	profit: "💰 Прибыль",
	loss: "📉 Убыток",
	closed: "🔒 Биржа закрыта",
	tax: "🛡️ Налоговая ловушка",
};

/* ─────────────────────── TaxShield widget ─────────────────────── */

function TaxShieldWidget({
	result,
	advice,
}: {
	result: TaxShieldResult | null;
	advice: string;
}) {
	if (!result) {
		return (
			<div className="wv-card wv-card--neutral">
				<div className="wv-icon"><Shield className="wv-icon__icon wv-icon--neutral" /></div>
				<div className="wv-title">Налоговый щит</div>
				<p className="wv-text">{advice}</p>
			</div>
		);
	}

	const isUrgent = result.status === "urgent";
	const isSafe = result.status === "safe";

	return (
		<div className={`wv-card ${isUrgent ? "wv-card--urgent" : isSafe ? "wv-card--safe" : "wv-card--warning"}`}>
			<div className="wv-card__header">
				<div className="wv-icon">
					{isUrgent ? (
						<>
							<Shield className="wv-icon__icon wv-icon--urgent" />
							<Hourglass className="wv-icon__timer" />
						</>
					) : isSafe ? (
						<ShieldCheck className="wv-icon__icon wv-icon--safe" />
					) : (
						<>
							<Shield className="wv-icon__icon wv-icon--warning" />
							<Hourglass className="wv-icon__timer" />
						</>
					)}
				</div>
				<div className="wv-badge">{isUrgent ? "СРОЧНО" : isSafe ? "ЛДВ активна" : "БЛИЗКО"}</div>
			</div>
			<div className="wv-title">{result.position.ticker}</div>
			<p className="wv-text">{result.advice}</p>
			<div className="wv-meta">
				<span>Владение: {result.heldLabel}</span>
				{result.ndflAtRisk > 0 && (
					<span>НДФЛ риск: {result.ndflAtRisk.toLocaleString("ru-RU")} ₽</span>
				)}
			</div>
		</div>
	);
}

/* ─────────────────────── MarketCalendar widget ─────────────────────── */

function MarketCalendarWidget({
	market,
	forcedStatus,
}: {
	market: MarketInfo;
	forcedStatus?: MarketInfo;
}) {
	const info = forcedStatus || market;
	const isOpen = info.isTrading;

	const statusIcon = isOpen ? (
		<Activity className="wv-icon__icon wv-icon--open" />
	) : (
		<Lock className="wv-icon__icon wv-icon--closed" />
	);

	return (
		<div className={`wv-card ${isOpen ? "wv-card--open" : "wv-card--closed"}`}>
			<div className="wv-card__header">
				<div className="wv-icon">{statusIcon}</div>
				<div className="wv-badge" style={{
					background: isOpen
						? "rgba(125, 255, 138, 0.2)"
						: "rgba(255, 90, 90, 0.2)",
					color: isOpen ? "#7dff8a" : "#ff5a5a",
				}}>
					{info.label}
				</div>
			</div>
			<div className="wv-title">Торговый календарь MOEX</div>
			<p className="wv-text">{info.advice}</p>
			<div className="wv-meta">
				<Clock className="wv-meta__icon" />
				<span>Следующая сессия: {info.nextSession}</span>
			</div>
		</div>
	);
}

/* ─────────────────────── BehavioralShield widget ─────────────────────── */

function BehavioralShieldWidget({
	shield,
	onRelax,
	relaxPlaying,
}: {
	shield: BehavioralShieldResult;
	onRelax: () => void;
	relaxPlaying: boolean;
}) {
	if (shield.level === "calm") {
		return (
			<div className="wv-card wv-card--neutral">
				<div className="wv-icon">
					<Umbrella className="wv-icon__icon wv-icon--neutral" />
				</div>
				<div className="wv-title">Спасение от паники</div>
				<p className="wv-text">{shield.advice}</p>
			</div>
		);
	}

	const isDanger = shield.level === "danger";
	const isShield = shield.level === "shield";

	return (
		<div className={`wv-card ${isDanger ? "wv-card--danger" : "wv-card--shield"}`}>
			<div className="wv-card__header">
				<div className="wv-icon">
					<Umbrella className={`wv-icon__icon ${isDanger ? "wv-icon--danger" : "wv-icon--shield"}`} />
				</div>
				<div className="wv-badge" style={{
					background: isDanger
						? "rgba(255, 90, 90, 0.2)"
						: "rgba(90, 180, 255, 0.2)",
					color: isDanger ? "#ff5a5a" : "#5ab4ff",
				}}>
					{isDanger ? "⚠️ Красная зона" : "🛡️ Заморозь панику"}
				</div>
			</div>
			<div className="wv-title">{shield.title}</div>
			<p className="wv-text">{shield.advice}</p>

			{shield.relaxMode && (
				<motion.button
					className="wv-relax-btn"
					whileTap={{ scale: 0.96 }}
					onClick={onRelax}
				>
					{relaxPlaying ? (
						<>
							<Wind className="wv-btn__icon" />
							Стоп шум
						</>
					) : (
						<>
							<Wind className="wv-btn__icon" />
							Включить белый шум
						</>
					)}
				</motion.button>
			)}
		</div>
	);
}

/* ─────────────────────── Главный компонент ─────────────────────── */

export function WealthBlock({
	portfolio,
	analysis,
	scenario: propScenario,
	onScenarioChange,
	demoMode,
}: {
	portfolio: TinkoffPortfolioData;
	analysis: PortfolioAnalysis;
	scenario: WealthScenario;
	onScenarioChange: (s: WealthScenario) => void;
	demoMode: boolean;
}) {
	const [relaxAudio] = useState(() => new RelaxAudio());
	const [relaxPlaying, setRelaxPlaying] = useState(false);

	const handleRelax = useCallback(() => {
		if (relaxAudio.playing) {
			relaxAudio.stop();
			setRelaxPlaying(false);
		} else {
			void relaxAudio.start().then(() => setRelaxPlaying(true));
		}
	}, [relaxAudio]);

	// Данные из портфеля
	const marketInfo = useMemo(() => getMarketStatus(), []);

	const taxResult = useMemo(
		() =>
			findTaxTrap(
				portfolio.stocks.map((s) => ({
					ticker: s.ticker,
					heldSince: s.heldSince,
					pnl: s.pnl,
				})),
			),
		[portfolio.stocks],
	);

	const panicShield = useMemo(
		() => analyzePanicRisk(portfolio),
		[portfolio],
	);

	// Моковые данные для демо-сценариев
	const scenarioData = useMemo(() => {
		switch (propScenario) {
			case "profit":
				return {
					market: undefined, // реальные данные
					taxAdvice: "Активы в портфеле свежие — до 3-летия ЛДВ ещё далеко. Сейчас не время для налоговой тревоги.",
					pnlPercent: 5.2,
					pnl: portfolio.balance * 0.052,
				};
			case "loss":
				return {
					market: undefined,
					taxAdvice: "В убыточной ситуации налоговая ловушка неактуальна. Сосредоточься на сохранении капитала.",
					pnlPercent: -5.2,
					pnl: -portfolio.balance * 0.052,
				};
			case "closed":
				return {
					market: {
						...getMarketStatus(),
						status: "closed-tech" as const,
						label: "Технические работы",
						isTrading: false,
						nextSession: "пн, 09:00 МСК",
						advice:
							"Сегодня на MOEX технические работы — торги не идут. Расслабься, не смотри на графики и не принимай импульсивных решений. Колобок пока почитает тебе сказку.",
					},
					taxAdvice: "Рынок закрыт — никаких сделок сегодня. Отличный повод проверить налоговую стратегию.",
					pnlPercent: portfolio.pnlPercent,
					pnl: portfolio.pnl,
				};
			case "tax":
				return {
					market: undefined,
					taxAdvice:
						"Внимание! Ты владеешь акциями SBER уже 2 года и 10 месяцев. Если продашь сейчас — заплатишь 13% НДФЛ. Подожди 2 месяца до ЛДВ, и государство вернёт тебе эти деньги.",
					pnlPercent: portfolio.pnlPercent,
					pnl: portfolio.pnl,
				};
		}
	}, [propScenario, portfolio]);

	// Авто-сценарий (если не демо)
	const effectiveScenario = demoMode
		? propScenario
		: portfolio.pnl >= 0
			? "profit"
			: "loss";

	// Считаем эффективный PnL для отображения
	const effectivePnlPercent =
		effectiveScenario === "profit"
			? 5.2
			: effectiveScenario === "loss"
				? -5.2
				: portfolio.pnlPercent;
	const effectivePnl =
		effectiveScenario === "profit"
			? portfolio.balance * 0.052
			: effectiveScenario === "loss"
				? -portfolio.balance * 0.052
				: portfolio.pnl;

	return (
		<motion.section
			className="wv-block"
			initial={{ opacity: 0, x: -40 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ delay: 0.2, duration: 0.5 }}
		>
			{/* Шапка с селектором сценария */}
			<div className="wv-header">
				<div className="wv-zone-header">
					<Landmark className="wv-icon--header" />
					<h3 className="wv-zone-title">Wealth & Risk</h3>
				</div>
				{demoMode && (
					<select
						className="wv-scenario-select"
						value={propScenario}
						onChange={(e) => onScenarioChange(e.target.value as WealthScenario)}
					>
						{(Object.entries(SCENARIO_LABELS) as [WealthScenario, string][]).map(
							([key, label]) => (
								<option key={key} value={key}>
									{label}
								</option>
							),
						)}
					</select>
				)}
			</div>

			{/* Баланс */}
			<div className="wv-balance">
				<div className="wv-balance-label">
					Портфель {portfolio.source === "ocr" ? "(по скриншоту)" : "(демо)"}
				</div>
				<div className="wv-balance-value">
					{portfolio.balance.toLocaleString("ru-RU")} ₽
				</div>
				<div
					className="wv-balance-pnl"
					style={{ color: effectivePnl >= 0 ? "#7dff8a" : "#ff5a5a" }}
				>
					{effectivePnl >= 0 ? (
						<TrendingUp className="inline w-4 h-4 mr-1" />
					) : (
						<TrendingDown className="inline w-4 h-4 mr-1" />
					)}
					{effectivePnl >= 0 ? "+" : ""}
					{effectivePnlPercent.toFixed(1)}% за день
				</div>
			</div>

			{/* Три виджета */}
			<div className="wv-widgets">
				{/* 1. Налоговый щит */}
				<TaxShieldWidget
					result={effectiveScenario === "tax" ? null : taxResult}
					advice={
						effectiveScenario === "tax"
							? scenarioData.taxAdvice
							: taxResult?.advice ?? scenarioData.taxAdvice
					}
				/>

				{/* 2. Торговый календарь */}
				<MarketCalendarWidget
					market={marketInfo}
					forcedStatus={scenarioData.market}
				/>

				{/* 3. Спасение от паники */}
				<BehavioralShieldWidget
					shield={
						effectiveScenario === "loss"
							? {
									level: "shield",
									title: "🛡️ Спасение от паники",
									advice: `Портфель просел на 5.2%. Это нормальная рыночная коррекция. Исторически рынок всегда восстанавливался. Не продавай в минус. Я включил для тебя успокаивающую музыку.`,
									relaxMode: true,
								}
							: panicShield
					}
					onRelax={handleRelax}
					relaxPlaying={relaxPlaying}
				/>
			</div>

			{/* Фьючерсы (как было) */}
			<div className="wv-positions">
				{portfolio.futures.map((f) => (
					<div key={f.ticker} className={`wv-pos ${f.marginRisk > 70 ? "danger" : ""}`}>
						<span className="wv-pos-ticker">{f.ticker}</span>
						<span className="wv-pos-risk">{f.marginRisk}% маржи</span>
						<span style={{ color: f.currentPnl >= 0 ? "#7dff8a" : "#ff5a5a" }}>
							{f.currentPnl >= 0 ? "+" : ""}
							{f.currentPnl}₽
						</span>
					</div>
				))}
			</div>

			{/* Совет по фьючерсу (без кнопки «Выполнить») */}
			<AnimatePresence>
				{analysis.stressScore > 30 && (
					<motion.div
						className="wv-advice-card"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
					>
						<div className="wv-advice-headline">
							<span className="wv-advice-icon">⚡</span>
							Анализ риска портфеля
						</div>
						<p className="wv-advice-text">
							{analysis.stressScore > 60
								? "Высокий уровень стресса — рекомендуется снизить плечо и пересмотреть стоп-лоссы. Не принимай решений на эмоциях."
								: "Умеренный риск — текущая стратегия управляема. Продолжай следить за экспирациями и новостным фоном."}
						</p>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.section>
	);
}
