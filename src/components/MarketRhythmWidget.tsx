/**
 * MarketRhythmWidget — «Ритм Рынка».
 *
 * Адаптирует жизнь пользователя под статус торгов МосБиржи:
 *  1. Закрыто (техработы / выходной / праздник / ночь) — «отключи графики»
 *  2. Скоро открытие (премаркет, < 60 мин) — «успей кофе, будь готов»
 *  3. Торги идут — live-статус, часы МСК, отсчёт до конца сессии
 *
 * По умолчанию работает на РЕАЛЬНОМ времени: marketClock считает открытие
 * по регламенту MOEX, счётчик тикает каждую секунду к фактической дате.
 * Демо-сценарии нужны только для питча и включаются вручную.
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

import {
	formatCountdown,
	getMarketClock,
	type ClockState,
	type MarketClock,
} from "../modules/advisory/marketClock";

/* ─────────────────────── типы ─────────────────────── */

/** «live» — реальные часы MOEX; остальное — витрины для питча. */
export type MarketState = "live" | "closed" | "premarket" | "trading" | "weekend";

export const MARKET_STATE_LABELS: Record<MarketState, string> = {
	live: "⏱ Реальное время MOEX",
	closed: "🔒 Техработы",
	premarket: "☀️ Скоро открытие",
	trading: "📈 Торги идут",
	weekend: "🌙 Выходной",
};

interface RhythmView {
	label: string;
	icon: React.ReactNode;
	accent: string;
	text: string;
	subtext: string;
	countdown?: string;
	countdownLabel?: string;
	live?: boolean;
	/** Часы МСК в шапке (для активной сессии). */
	mskClock?: string;
	/** «Закрыто до: 26 окт. 06:50:00» — как на сайте MOEX. */
	closedUntil?: string;
	actionButton?: {
		label: string;
		icon: React.ReactNode;
		variant?: "rest";
	};
	lifeSync?: { title: string; text: string; emoji: string };
	weekendTrap?: { title: string; text: string; ctaLabel: string };
}

/* ─────────────────────── визуал состояний ─────────────────────── */

const STATE_VISUAL: Record<ClockState, Pick<RhythmView, "icon" | "accent" | "live">> = {
	"trading": { icon: <Activity className="wv-icon__icon wv-icon--open" />, accent: "#7dff8a", live: true },
	"closing-soon": { icon: <Activity className="wv-icon__icon wv-icon--warning" />, accent: "#ffb347", live: true },
	"premarket": { icon: <Sun className="wv-icon__icon wv-icon--warning" />, accent: "#ffd766" },
	"closed-off-hours": { icon: <Moon className="wv-icon__icon wv-icon--closed" />, accent: "#5a8fff" },
	"closed-weekend": { icon: <Moon className="wv-icon__icon wv-icon--closed" />, accent: "#cfc3f2" },
	"closed-holiday": { icon: <Moon className="wv-icon__icon wv-icon--safe" />, accent: "#cfc3f2" },
	"closed-tech": { icon: <Lock className="wv-icon__icon wv-icon--closed" />, accent: "#5a8fff" },
};

/* ─────────────────────── вспомогательное ─────────────────────── */

function pluralDays(n: number): string {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return `${n} день`;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} дня`;
	return `${n} дней`;
}

/** «Синхронизация с жизнью»: длинный перерыв → идея мини-отпуска. */
function buildLifeSync(msToOpen: number): RhythmView["lifeSync"] {
	const days = Math.max(1, Math.round(msToOpen / 86_400_000));
	return {
		title: `Мини-отпуск на ${pluralDays(days)}`,
		text:
			"Впереди без торгов — отличное время, чтобы съездить на природу. " +
			"Колобок подобрал маршрут на день и чек-лист вещей в рюкзак.",
		emoji: "🌲",
	};
}

/** Текущие часы МСК: «23:46:12 МСК». */
function mskClockNow(): string {
	const now = new Date(Date.now() + (3 * 60 + new Date().getTimezoneOffset()) * 60_000);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())} МСК`;
}

/* ─────────────────────── сборка вьюхи из часов ─────────────────────── */

function buildView(clock: MarketClock): RhythmView {
	const visual = STATE_VISUAL[clock.state];
	const head: RhythmView = {
		label: clock.label,
		...visual,
		text: clock.advice,
		subtext: "",
	};

	switch (clock.state) {
		case "trading":
		case "closing-soon":
			return {
				...head,
				subtext:
					"Следуй плану на сегодня. Позиции в плюсе — не добавляй на эйфории; " +
					"в минусе — не усредняй на эмоции. Колобок не открывает сделки за тебя.",
				countdown: clock.countdown,
				countdownLabel: "До конца сессии",
				mskClock: mskClockNow(),
				actionButton: {
					label: "Мой план на сегодня",
					icon: <Rocket className="wv-btn__icon" />,
				},
			};

		case "premarket":
			return {
				...head,
				subtext:
					"Проверь новости перед стартом: утро даёт главную волатильность дня. " +
					"Заранее реши, какую сделку открываешь и где стоит твой стоп.",
				countdown: clock.countdown,
				countdownLabel: "До открытия",
				mskClock: mskClockNow(),
				actionButton: {
					label: "Обзор новостей дня",
					icon: <FlameKindling className="wv-btn__icon" />,
				},
			};

		case "closed-tech":
			return {
				...head,
				subtext:
					"Торги возобновятся по расписанию ниже. За время техработ ничего не изменится — " +
					"решений «на всякий случай» не понадобится.",
				countdown: clock.countdown,
				countdownLabel: "До открытия",
				closedUntil: clock.closedUntil,
				actionButton: {
					label: "Включить режим отдыха",
					icon: <Moon className="wv-btn__icon" />,
					variant: "rest",
				},
				lifeSync: buildLifeSync(clock.millisUntilOpen),
			};

		case "closed-weekend":
			return {
				...head,
				subtext:
					"Не совершай импульсивных сделок из-за скуки. Лучше потрать время на обучение — " +
					"перейди в блок Skills.",
				countdown: clock.countdown,
				countdownLabel: "До открытия",
				closedUntil: clock.closedUntil,
				weekendTrap: {
					title: "Ловушка выходного дня",
					text:
						"Крипта и фьючерсы торгуются 24/7, но фондовый рынок спит. " +
						"Сделки «от скуки» — самый дорогой способ убить время.",
					ctaLabel: "Перейти в Skills",
				},
				lifeSync:
					clock.millisUntilOpen >= 2 * 86_400_000
						? buildLifeSync(clock.millisUntilOpen)
						: undefined,
			};

		case "closed-holiday":
			return {
				...head,
				subtext: "Позиции подождут, а этот день не повторится.",
				countdown: clock.countdown,
				countdownLabel: "До открытия",
				closedUntil: clock.closedUntil,
				actionButton: {
					label: "Включить режим отдыха",
					icon: <Moon className="wv-btn__icon" />,
					variant: "rest",
				},
				lifeSync: buildLifeSync(clock.millisUntilOpen),
			};

		default:
			return {
				...head,
				subtext:
					"Не проверяй портфель каждую минуту — утром всё будет видно так же хорошо.",
				countdown: clock.countdown,
				countdownLabel: "До открытия",
				closedUntil: clock.closedUntil,
				actionButton: {
					label: "Включить режим отдыха",
					icon: <Moon className="wv-btn__icon" />,
					variant: "rest",
				},
			};
	}
}

/* ─────────────────────── демо-сценарии (только для питча) ─────────────────────── */

const DEMO_CLOCKS: Record<Exclude<MarketState, "live">, MarketClock> = {
	closed: {
		state: "closed-tech",
		label: "Технические работы",
		isTrading: false,
		millisUntilOpen: 31_382_000,
		millisUntilClose: 0,
		countdown: formatCountdown(31_382_000),
		nextSession: "пн, 26 окт, 06:50 МСК",
		closedUntil: "26 окт. 06:50:00",
		advice:
			"Биржа закрыта на технические работы. Твой портфель в безопасности. " +
			"Отключи уведомления и не смотри на графики: лучшее решение сейчас — выспаться, " +
			"а завтра начнём с чистого листа.",
	},
	premarket: {
		state: "premarket",
		label: "Скоро открытие",
		isTrading: false,
		millisUntilOpen: 2_700_000,
		millisUntilClose: 0,
		countdown: formatCountdown(2_700_000),
		nextSession: "сегодня, 06:50 МСК",
		closedUntil: "сегодня. 06:50:00",
		advice:
			"До открытия рынка 45 минут. Успей выпить кофе — портфель готов. " +
			"Главная новость дня: ожидается публикация отчётности Сбера. Будь готов к волатильности.",
	},
	trading: {
		state: "trading",
		label: "Торги идут",
		isTrading: true,
		millisUntilOpen: 0,
		millisUntilClose: 3_240_000,
		countdown: formatCountdown(3_240_000),
		nextSession: "сегодня, до 23:50 МСК",
		closedUntil: "",
		advice: "Рынок открыт. Все системы в норме. Помни о своём риск-менеджменте.",
	},
	weekend: {
		state: "closed-weekend",
		label: "Выходной",
		isTrading: false,
		millisUntilOpen: 172_800_000,
		millisUntilClose: 0,
		countdown: formatCountdown(172_800_000),
		nextSession: "пн, 26 окт, 06:50 МСК",
		closedUntil: "26 окт. 06:50:00",
		advice:
			"На бирже выходной — торги возобновятся в понедельник. " +
			"Графики стоят, а жизнь идёт: это лучший момент для прогулки, кухни и семьи.",
	},
};

/* ─────────────────────── компонент ─────────────────────── */

export function MarketRhythmWidget({
	scenario = "live",
	onRestMode,
	navigateToSkills,
}: {
	scenario?: MarketState;
	onRestMode?: (v: boolean) => void;
	navigateToSkills?: () => void;
}) {
	const [mode, setMode] = useState<MarketState>(scenario);
	const [restModeActive, setRestModeActive] = useState(false);
	/** Тик раз в секунду — заставляет часы пересчитываться. */
	const [tick, setTick] = useState(0);

	useEffect(() => {
		setMode(scenario);
	}, [scenario]);

	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 1000);
		return () => clearInterval(id);
	}, []);

	// `tick` в зависимостях — иначе useMemo законсервировал бы старое время.
	const view = useMemo<RhythmView>(() => {
		if (mode === "live") return buildView(getMarketClock());
		const demo = DEMO_CLOCKS[mode];
		return buildView({
			...demo,
			countdown: formatCountdown(demo.isTrading ? demo.millisUntilClose : demo.millisUntilOpen),
		});
	}, [mode, tick]);

	const toggleRest = useCallback(() => {
		setRestModeActive((prev) => {
			onRestMode?.(!prev);
			return !prev;
		});
	}, [onRestMode]);

	const handleMode = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
		setMode(e.target.value as MarketState);
	}, []);

	/* ── Режим отдыха ── */
	if (restModeActive) {
		return (
			<motion.section
				className="mr-widget mr-widget--rest"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<div className="mr-header">
					<div className="mr-header__left">
						<Leaf className="mr-header__icon" />
						<h3 className="mr-title">Режим отдыха активен</h3>
					</div>
				</div>
				<p className="mr-rest-text">
					Колобок приглушил финансовые виджеты. Биржа спит — и тебе надо. 🫓
				</p>
				<motion.button className="mr-reset-btn" whileTap={{ scale: 0.96 }} onClick={toggleRest}>
					<CirclePause className="mr-btn__icon" />
					Завершить отдых
				</motion.button>
			</motion.section>
		);
	}

	return (
		<motion.section
			className="mr-widget"
			initial={{ opacity: 0, scale: 0.98 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
			style={{
				borderColor: view.accent + "40",
				boxShadow: `0 0 30px ${view.accent}15`,
			}}
		>
			{/* ── ШАПКА ── */}
			<div className="mr-header">
				<div className="mr-header__left">
					{view.icon}
					<h3 className="mr-title">{view.label}</h3>
					{view.live && <span className="mr-live-dot" title="Live" />}
				</div>
				{view.mskClock && <span className="mr-msk">{view.mskClock}</span>}
			</div>

			{/* ── КОНТЕНТ ── */}
			<div className="mr-body">
				<p className="mr-headline">{view.text}</p>
				{view.subtext && <p className="mr-subtext">{view.subtext}</p>}

				{view.countdown && (
					<div className="mr-countdown">
						<Clock className="mr-countdown__icon" />
						<div className="mr-countdown__value">{view.countdown}</div>
						<div className="mr-countdown__label">{view.countdownLabel}</div>
					</div>
				)}

				{view.closedUntil && (
					<div className="mr-closed-until">Закрыто до: {view.closedUntil}</div>
				)}

				{view.actionButton && (
					<motion.button
						className={`mr-action-btn ${view.actionButton.variant === "rest" ? "mr-action--rest" : ""}`}
						whileTap={{ scale: 0.96 }}
						onClick={() => view.actionButton?.variant === "rest" && toggleRest()}
						style={{ borderColor: view.accent + "60", color: view.accent }}
					>
						{view.actionButton.icon}
						{view.actionButton.label}
					</motion.button>
				)}

				{view.weekendTrap && (
					<div className="mr-trap">
						<ShieldAlert className="mr-trap__icon" />
						<div>
							<div className="mr-trap-title">{view.weekendTrap.title}</div>
							<div className="mr-trap-text">{view.weekendTrap.text}</div>
							<motion.button
								className="mr-trap-cta"
								whileTap={{ scale: 0.96 }}
								onClick={() => navigateToSkills?.()}
							>
								{view.weekendTrap.ctaLabel} →
							</motion.button>
						</div>
					</div>
				)}

				{view.lifeSync && (
					<div className="mr-lifesync">
						<div className="mr-lifesync-emoji">{view.lifeSync.emoji}</div>
						<div>
							<div className="mr-lifesync-title">{view.lifeSync.title}</div>
							<div className="mr-lifesync-text">{view.lifeSync.text}</div>
						</div>
					</div>
				)}
			</div>

			{/* ── ПЕРЕКЛЮЧАТЕЛЬ ИСТОЧНИКА ── */}
			<div className="mr-demo-switcher">
				<label className="mr-demo-label">Источник:</label>
				<select className="mr-scenario-select" value={mode} onChange={handleMode}>
					{(Object.entries(MARKET_STATE_LABELS) as [MarketState, string][]).map(
						([key, label]) => (
							<option key={key} value={key}>
								{label}
							</option>
						),
					)}
				</select>
			</div>
		</motion.section>
	);
}
