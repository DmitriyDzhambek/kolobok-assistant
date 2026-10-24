/**
 * Advisory Mode — «Торговый календарь MOEX».
 *
 * Определяет статус торгов на МосБирже прямо сейчас:
 *   • выходной / праздник РФ → рынок закрыт;
 *   • техработы (MOEX регулярно проводит тестовые клиринги в ночь
 *     с пятницы на субботу — это реальный паттерн, а не выдумка);
 *   • короткий день (накануне праздников, сессия короче);
 *   • обычная сессия.
 *
 * Колобок использует это как «поведенческий стоп-кран»: если рынок
 * закрыт, нет смысла смотреть графики и принимать импульсивных решений.
 */

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
	/** Когда следующая сессия, напр. «пн, 09:00 МСК». */
	nextSession: string;
	/** Совет от Колобка (Advisory Mode — только текст, без кнопок). */
	advice: string;
}

/** Праздничные дни РФ, когда MOEX закрыта (несокращаемый список). */
const RUSSIAN_HOLIDAYS: Array<[month: number, day: number, name: string]> = [
	[1, 1, "Новогодние каникулы"],
	[1, 2, "Новогодние каникулы"],
	[1, 3, "Новогодние каникулы"],
	[1, 4, "Новогодние каникулы"],
	[1, 5, "Новогодние каникулы"],
	[1, 6, "Новогодние каникулы"],
	[1, 7, "Рождество"],
	[1, 8, "Новогодние каникулы"],
	[2, 23, "День защитника Отечества"],
	[3, 8, "Международный женский день"],
	[5, 1, "Праздник Весны и Труда"],
	[5, 9, "День Победы"],
	[6, 12, "День России"],
	[11, 4, "День народного единства"],
];

/**
 * Плановые технические работы MOEX (моковые даты для MVP).
 * В проде подтягивать с https://www.moex.com/s89 (расписание).
 */
const TECH_WORKS: Array<{ date: string; note: string }> = [
	// дата в формате YYYY-MM-DD, время МСК
	{ date: "2026-11-01", note: "ночь с пятницы на субботу" },
	{ date: "2026-12-06", note: "ночь с пятницы на субботу" },
];

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function holidayName(d: Date): string | null {
	const hit = RUSSIAN_HOLIDAYS.find(
		([m, day]) => m === d.getMonth() + 1 && day === d.getDate()
	);
	return hit ? hit[2] : null;
}

function isTechWorkDay(d: Date): string | null {
	const iso = d.toISOString().slice(0, 10);
	const hit = TECH_WORKS.find((t) => t.date === iso);
	return hit ? hit.note : null;
}

function fmtNextSession(d: Date): string {
	const next = new Date(d);
	next.setDate(next.getDate() + 1);
	next.setHours(9, 0, 0, 0);
	return `${WEEKDAYS[next.getDay()]}, 09:00 МСК`;
}

/** Текущий статус торгов на MOEX (по времени МСК, UTC+3). */
export function getMarketStatus(now: Date = new Date()): MarketInfo {
	// Переводим в МСК (UTC+3) без учёта DST — в РФ его нет.
	const msk = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60_000);
	const dow = msk.getDay();
	const hour = msk.getHours();
	const minute = msk.getMinutes();
	const holiday = holidayName(msk);
	const tech = isTechWorkDay(msk);
	const fmt = (n: number) => String(n).padStart(2, "0");

	// ── Технические работы (ночные клиринги + тест) ────────────────
	if (tech && (hour >= 19 || hour < 9)) {
		return {
			status: "closed-tech",
			label: "Технические работы",
			isTrading: false,
			nextSession: fmtNextSession(msk),
			advice:
				"Сегодня на MOEX технические работы — торги не идут. Расслабься, не смотри на графики и не принимай импульсивных решений. Колобок пока почитает тебе сказку.",
		};
	}

	// ── Выходные ───────────────────────────────────────────────────
	if (dow === 0 || dow === 6) {
		return {
			status: "closed-weekend",
			label: "Выходной",
			isTrading: false,
			nextSession: fmtNextSession(msk),
			advice:
				"На бирже выходной — графики стоят, а жизнь идёт. Не пересиди в кресле: это лучший момент для прогулки, кухни и семьи. Рынок подождёт до понедельника.",
		};
	}

	// ── Праздники ──────────────────────────────────────────────────
	if (holiday) {
		return {
			status: "closed-holiday",
			label: `Праздник: ${holiday}`,
			isTrading: false,
			nextSession: fmtNextSession(msk),
			advice: `Сегодня ${holiday} — MOEX закрыта. Отмечай спокойно, позиции подождут. Колобок напоминает: лучший трейд дня — тот, где ты не трейдил.`,
		};
	}

	// ── Короткий день (накануне праздников, сессия до 18:45) ──────
	const tomorrow = new Date(msk);
	tomorrow.setDate(tomorrow.getDate() + 1);
	const eveOfHoliday = dow === 5 && holidayName(tomorrow) !== null;
	if (eveOfHoliday) {
		return {
			status: "short-day",
			label: "Короткий день",
			isTrading: hour >= 9 && hour < 18,
			nextSession: "пн, 09:00 МСК",
			advice:
				"Сегодня короткий торговый день — сессия закончится раньше обычного. Не оставляй «на потом» то, что хотел сделать: после 18:45 рынок уснёт до понедельника.",
		};
	}

	// ── Обычная сессия ─────────────────────────────────────────────
	if (hour >= 9 && hour < 18) {
		return {
			status: "open",
			label: "Открыто",
			isTrading: true,
			nextSession: `сегодня, до 23:50 МСК`,
			advice: `Рынок открыт — основная сессия идёт до 19:00 МСК. Помни: Колобок не торгует за тебя. Если нет торгов по плану — не выдумывай их.`,
		};
	}
	if (hour >= 18 && hour < 19) {
		return {
			status: "closing-soon",
			label: "Сконец сессии",
			isTrading: true,
			nextSession: `завтра, 09:00 МСК`,
			advice: `До конца основной сессии меньше часа (${fmt(hour)}:${fmt(minute)} МСК). Хорошее время подвести итоги дня и закрыть ноутбук.`,
		};
	}

	return {
		status: "closed-weekend",
		label: "Вне сессии",
		isTrading: false,
		nextSession: fmtNextSession(msk),
		advice:
			"Сейчас вне торговой сессии — вечер, рынок спит. Не проверяй портфель каждую минуту, завтра утром всё будет видно.",
	};
}
