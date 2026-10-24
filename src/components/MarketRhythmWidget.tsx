/**
 * MarketRhythmWidget — «Ритм Рынка».
 *
 * Умный виджет, который адаптирует жизнь пользователя под статус биржи:
 *  1. Закрыто (техработы / выходной) — «отключи графики, выспись»
 *  2. Скоро открытие (Pre-Market < 60 мин) — «успей кофе, будь готов»
 *  3. Торги идут (Active Session) — «все системы в норме»
 *  4. Выходной (суббота/воскресенье) — «не торгуй из-за скуки»
 *
 * Демо-переключатель в шапке — меняет всю карточку целиком
 * для питча перед инвестором.
 *
 * Advisory Mode: только текстовые советы, никаких кнопок сделок.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	Moon,
	Sun,
	Lock,
	Activity,
	ShieldAlert,
	Clock,
	FlameKindling,
	Leaf,
	Rocket,
	CirclePause,
} from "lucide-react";

/* ─────────────────────── типы ─────────────────────── */

export type MarketState = "closed" | "premarket" | "trading" | "weekend";

export interface MarketRhythmData {
	state: MarketState;
	label: string;
	icon: React.ReactNode;
	accent: string;
	text: string;
	subtext: string;
	countdown?: string;
	countdownLabel?: string;
	actionButton?: {
		label: string;
		icon: React.ReactNode;
		onClick: () => void;
		danger?: boolean;
	};
	lifeSync?: {
		title: string;
		text: string;
		emoji: string;
	};
	weekendTrap?: {
		title: string;
		text: string;
		ctaLabel: string;
	};
}

/* ─────────────────────── демо-данные состояний ─────────────────────── */

const MARKET_SCENARIOS: MarketRhythmData[] = [
	{
		state: "closed",
		label: "Технические работы",
		icon: <Lock className="wv-icon__icon wv-icon--closed" />,
		accent: "#5a8fff",
		text: "Биржа закрыта на технические работы до 26 октября. Твой портфель в безопасности.",
		subtext:
			"Я рекомендую отключить уведомления и не смотреть на графики. Лучшее решение сейчас — выспаться, а завтра мы начнем с чистого листа.",
		countdown: "01:08:41",
		countdownLabel: "До открытия",
		actionButton: {
			label: "Включить режим отдыха",
			icon: <Moon className="wv-btn__icon" />,
			onClick: () => {},
		},
		lifeSync: {
			title: "Мини-отпуск на 3 дня",
			text: "Впереди длинные выходные без торгов. Отличное время, чтобы съездить на природу. Я подобрал маршрут и чек-лист вещей.",
			emoji: "🌲",
		},
	},
	{
		state: "premarket",
		label: "Скоро открытие",
		icon: <Sun className="wv-icon__icon wv-icon--warning" />,
		accent: "#ffd766",
		text: "До открытия рынка 45 минут. Успей выпить кофе. Твой портфель готов.",
		subtext:
			"Главная новость дня: ожидается публикация отчётности Сбера. Будь готов к волатильности.",
		countdown: "00:45:00",
		countdownLabel: "До открытия",
		actionButton: {
			label: "Обзор новостей дня",
			icon: <FlameKindling className="wv-btn__icon" />,
			onClick: () => {},
		},
	},
	{
		state: "trading",
		label: "Торги идут",
		icon: <Activity className="wv-icon__icon wv-icon--open" />,
		accent: "#7dff8a",
		text: "Рынок открыт. Все системы в норме.",
		subtext:
			"Помни о своем риск-менеджменте. Не торгуй на эмоциях — следуй своему плану.",
		actionButton: {
			label: "Мой план на сегодня",
			icon: <Rocket className="wv-btn__icon" />,
			onClick: () => {},
		},
	},
	{
		state: "weekend",
		label: "Выходной",
		icon: <Moon className="wv-icon__icon wv-icon--closed" />,
		accent: "#cfc3f2",
		text: "Сегодня выходные на фондовом рынке.",
		subtext:
			"Не совершай импульсивных сделок из-за скуки. Лучше потрать время на обучение — перейди в блок Skills для полезных материалов.",
		weekendTrap: {
			title: "Ловушка выходного дня",
			text: "Фьючерсы и крипто торгуются 24/7, но сегодня день отдыха. Твоя психика скажет спасибо.",
			ctaLabel: "Перейти в Skills",
		},
	},
];

/* ─────────────────────── компонент ─────────────────────── */

export function MarketRhythmWidget({
	scenario,
	onRestMode,
	navigateToSkills,
}: {
	scenario?: MarketState;
	onRestMode?: (v: boolean) => void;
	navigateToSkills?: () => void;
}) {
	const [localScenario, setLocalScenario] = useState<MarketState>(
		scenario ?? "closed",
	);
	const [countdown, setCountdown] = useState("01:08:41");
	const [restModeActive, setRestModeActive] = useState(false);

	// Синхронизация с пропом
	useEffect(() => {
		if (scenario !== undefined) setLocalScenario(scenario);
	}, [scenario]);

	// Таймер тикает
	useEffect(() => {
		const parts = countdown.split(":").map(Number);
		let totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];

		const id = setInterval(() => {
			totalSec = Math.max(0, totalSec - 1);
			const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
			const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
			const s = String(totalSec % 60).padStart(2, "0");
			setCountdown(`${h}:${m}:${s}`);
		}, 1000);

		return () => clearInterval(id);
	}, [countdown]);

	// Данные текущего сценария
	const data = useMemo(
		() => MARKET_SCENARIOS.find((s) => s.state === localScenario),
		[localScenario],
	);

	// Переключатель для демо
	const handleScenario = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const next = e.target.value as MarketState;
			setLocalScenario(next);
		},
		[],
	);

	// Кнопка режима отдыха
	const toggleRest = useCallback(() => {
		const next = !restModeActive;
		setRestModeActive(next);
		onRestMode?.(next);
	}, [restModeActive, onRestMode]);

	// Если REST MODE — показываем только кнопку "выключить отдых"
	if (restModeActive) {
		return (
			<motion.section
				className="mr-widget mr-widget--rest"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<div className="mr-header">
					<Leaf className="mr-header__icon" />
					<h3 className="mr-title">Режим отдыха активен</h3>
				</div>
				<p className="mr-rest-text">
					Колобок приглушил финансовые виджеты. Наслаждайся моментом. 🫓
				</p>
				<motion.button
					className="mr-reset-btn"
					whileTap={{ scale: 0.96 }}
					onClick={toggleRest}
				>
					<CirclePause className="mr-btn__icon" />
					Завершить отдых
				</motion.button>
			</motion.section>
		);
	}

	if (!data) return null;

	return (
		<motion.section
			className="mr-widget"
			key={localScenario}
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
			style={{
				borderColor: data.accent + "40",
				boxShadow: `0 0 30px ${data.accent}15`,
			}}
		>
			{/* ── ШАПКА ── */}
			<div className="mr-header">
				<div className="mr-header__left">
					{data.icon}
					<h3 className="mr-title">{data.label}</h3>
					{localScenario === "trading" && (
						<span className="mr-live-dot" title="Live" />
					)}
				</div>
			</div>

			{/* ── ОСНОВНОЙ КОНТЕНТ ── */}
			<div className="mr-body">
				<p className="mr-headline">{data.text}</p>
				<p className="mr-subtext">{data.subtext}</p>

				{/* Таймер */}
				{data.countdown && (
					<motion.div
						className="mr-countdown"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
					>
						<Clock className="mr-countdown__icon" />
						<div className="mr-countdown__value">{data.countdown}</div>
						<div className="mr-countdown__label">{data.countdownLabel}</div>
					</motion.div>
				)}

				{/* Кнопка действия */}
				{data.actionButton && (
					<motion.button
						className={`mr-action-btn ${data.accent === "#5a8fff" ? "mr-action--rest" : ""}`}
						whileTap={{ scale: 0.96 }}
						onClick={data.actionButton.onClick}
						style={{
							borderColor: data.accent + "60",
							color: data.accent,
						}}
					>
						{data.actionButton.icon}
						{data.actionButton.label}
					</motion.button>
				)}

				{/* Ловушка выходного дня */}
				{data.weekendTrap && (
					<motion.div
						className="mr-trap"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15 }}
					>
						<ShieldAlert className="mr-trap__icon" />
						<div>
							<div className="mr-trap-title">{data.weekendTrap.title}</div>
							<div className="mr-trap-text">{data.weekendTrap.text}</div>
							<motion.button
								className="mr-trap-cta"
								whileTap={{ scale: 0.96 }}
								onClick={() => navigateToSkills?.()}
							>
								{data.weekendTrap.ctaLabel} →
							</motion.button>
						</div>
					</motion.div>
				)}

				{/* Life Sync */}
				{data.lifeSync && (
					<motion.div
						className="mr-lifesync"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
					>
						<div className="mr-lifesync-emoji">{data.lifeSync.emoji}</div>
						<div>
							<div className="mr-lifesync-title">{data.lifeSync.title}</div>
							<div className="mr-lifesync-text">{data.lifeSync.text}</div>
						</div>
					</motion.div>
				)}
			</div>

			{/* ── ДЕМО-ПЕРЕКЛЮЧАТЕЛЬ ── */}
			<div className="mr-demo-switcher">
				<label className="mr-demo-label">Демо-сценарий:</label>
				<select
					className="mr-scenario-select"
					value={localScenario}
					onChange={handleScenario}
				>
					<option value="closed">🔒 Техработы</option>
					<option value="premarket">☀️ Скоро открытие</option>
					<option value="trading">📈 Торги идут</option>
					<option value="weekend">🌙 Выходной</option>
				</select>
			</div>
		</motion.section>
	);
}
