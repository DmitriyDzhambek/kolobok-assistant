/**
 * Advisory Mode — «Торговый календарь MOEX».
 *
 * Тонкая обёртка над marketClock: единый источник времени для всех
 * виджетов, чтобы «Ритм рынка» и карточка в Wealth не расходились
 * в цифрах (раньше здесь был моковый расчёт «завтра 09:00», который
 * врал в дни техработ и длинных выходных).
 */

import { getMarketClock, type ClockState } from "./marketClock";

export type MarketStatus =
	| "open"
	| "closing-soon"
	| "closed-weekend"
	| "closed-holiday"
	| "closed-tech"
	| "short-day";

export interface MarketInfo {
	status: MarketStatus;
	/** Человекочитаемый статус для чипа. */
	label: string;
	/** Открыто ли сейчас основное движение (акции/фьючерсы). */
	isTrading: boolean;
	/** Когда следующая сессия, напр. «пн, 26 окт, 06:50 МСК». */
	nextSession: string;
	/** Совет от Колобка (Advisory Mode — только текст, без кнопок). */
	advice: string;
}

const STATUS_BY_STATE: Record<ClockState, MarketStatus> = {
	"trading": "open",
	"closing-soon": "closing-soon",
	"premarket": "short-day",
	"closed-off-hours": "short-day",
	"closed-weekend": "closed-weekend",
	"closed-holiday": "closed-holiday",
	"closed-tech": "closed-tech",
};

/** Текущий статус торгов на MOEX (часы МСК, регламент биржи). */
export function getMarketStatus(now: Date = new Date()): MarketInfo {
	const clock = getMarketClock(now);
	return {
		status: STATUS_BY_STATE[clock.state],
		label: clock.label,
		isTrading: clock.isTrading,
		nextSession: clock.nextSession,
		advice: clock.advice,
	};
}
