/**
 * marketClock — реальное время до открытия/закрытия МосБиржи.
 *
 * Считает статус торгов по часам MOEX (МСК = UTC+3, DST в РФ нет) и
 * показывает обратный отсчёт в формате сайта: «1 дн. 07:03:27».
 *
 * Почему локальный расчёт, а не iss.moex.com: при закрытом рынке ISS
 * отдаёт пустые датасеты (проверено), а часы торгов MOEX — фиксированный
 * публичный регламент. Данные сверены с moex.com/s89 (24.10.2026).
 *
 * Все вычисления идут через UTC-геттеры над смещённым таймстампом,
 * поэтому результат не зависит от часовой зоны устройства пользователя.
 */

/* ─────────────────────── регламент MOEX ─────────────────────── */

/** Смещение МСК от UTC в минутах (UTC+3, перевода стрелок нет). */
const MSK_OFFSET_MIN = 180;

/** Премаркет / старт торгов — 06:50 МСК («Закрыто до: 26 окт. 06:50:00»). */
const OPEN_MIN = 6 * 60 + 50;
/** Конец вечерней сессии — 23:50 МСК. */
const CLOSE_MIN = 23 * 60 + 50;

/* ─────────────────────── календарь ─────────────────────── */

/** Праздничные дни РФ, когда MOEX закрыта (month — 1-базный). */
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
 * Плановые технические работы MOEX — ночь с пятницы на субботу.
 *更新日期 по https://www.moex.com/s89. В проде подменяются ответом API.
 */
const TECH_WORKS = new Set<string>([
	"2026-01-31", "2026-02-28", "2026-03-28", "2026-04-25",
	"2026-05-30", "2026-06-27", "2026-07-25", "2026-08-29",
	"2026-09-26", "2026-10-24", "2026-11-01", "2026-12-06",
]);

const WEEKDAYS_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;
const MONTHS_RU = [
	"янв", "фев", "мар", "апр", "мая", "июн",
	"июл", "авг", "сен", "окт", "ноя", "дек",
] as const;

/* ─────────────────────── типы ─────────────────────── */

export type ClockState =
	| "trading"
	| "closing-soon"
	| "premarket"
	| "closed-off-hours"
	| "closed-weekend"
	| "closed-holiday"
	| "closed-tech";

export interface MarketClock {
	state: ClockState;
	label: string;
	isTrading: boolean;
	/** Мс до начала следующей торговой сессии (0, если торги идут). */
	millisUntilOpen: number;
	/** Мс до конца текущей сессии (0, если торги не идут). */
	millisUntilClose: number;
	/** Обратный отсчёт для UI: «1 дн. 07:03:27». */
	countdown: string;
	/** Момент открытия: «пн, 26 окт, 06:50 МСК». */
	nextSession: string;
	/** Закрыто до (формат сайта MOEX): «26 окт. 06:50:00». */
	closedUntil: string;
	advice: string;
}

/* ─────────────────────── работа со временем ─────────────────────── */

interface MskParts {
	y: number;
	/** 0-базный месяц (как в JS). */
	mo: number;
	d: number;
	min: number;
	dow: number;
}

/** Раскладывает момент времени на «стеновые» часы МСК. */
function mskParts(now: Date): MskParts {
	const shifted = new Date(now.getTime() + MSK_OFFSET_MIN * 60_000);
	return {
		y: shifted.getUTCFullYear(),
		mo: shifted.getUTCMonth(),
		d: shifted.getUTCDate(),
		min: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
		dow: shifted.getUTCDay(),
	};
}

/** Минуты МСК → абсолютный epoch (мс). */
function mskToEpoch(y: number, mo: number, d: number, minOfDay: number): number {
	const utcMs = Date.UTC(y, mo, d, 0, 0, 0) + minOfDay * 60_000;
	return utcMs - MSK_OFFSET_MIN * 60_000;
}

function addDays(y: number, mo: number, d: number, days: number): { y: number; mo: number; d: number } {
	const t = new Date(Date.UTC(y, mo, d + days));
	return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate() };
}

function dowOf(y: number, mo: number, d: number): number {
	return new Date(Date.UTC(y, mo, d)).getUTCDay();
}

function holidayOf(_year: number, mo: number, d: number): string | null {
	const hit = RUSSIAN_HOLIDAYS.find(([m, day]) => m === mo + 1 && day === d);
	return hit ? hit[2] : null;
}

function keyOf(y: number, mo: number, d: number): string {
	return `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isTechWork(y: number, mo: number, d: number): boolean {
	return TECH_WORKS.has(keyOf(y, mo, d));
}

/** Торгуется ли биржа в этот день. */
function isTradingDay(y: number, mo: number, d: number): boolean {
	const dow = dowOf(y, mo, d);
	if (dow === 0 || dow === 6) return false;
	if (holidayOf(y, mo, d)) return false;
	if (isTechWork(y, mo, d)) return false;
	return true;
}

/** Ближайшее будущее открытие (epoch, мс) строго после `after`. */
function nextOpenEpoch(after: Date): number {
	const p = mskParts(after);
	let day = { y: p.y, mo: p.mo, d: p.d };

	// Если сегодня ещё торговый день и 06:50 ещё не прошло — открытие сегодня.
	const nowMs = after.getTime();
	const todayOpen = mskToEpoch(day.y, day.mo, day.d, OPEN_MIN);
	if (isTradingDay(day.y, day.mo, day.d) && todayOpen > nowMs) {
		return todayOpen;
	}

	for (let i = 1; i <= 400; i++) {
		day = addDays(p.y, p.mo, p.d, i);
		if (isTradingDay(day.y, day.mo, day.d)) {
			return mskToEpoch(day.y, day.mo, day.d, OPEN_MIN);
		}
	}
	// Календарь не покрыт данными — честный фолбэк на «следующий понедельник».
	let guard = 1;
	while (dowOf(day.y, day.mo, day.d) !== 1 && guard < 10) {
		day = addDays(day.y, day.mo, day.d, 1);
		guard++;
	}
	return mskToEpoch(day.y, day.mo, day.d, OPEN_MIN);
}

/** Ближайшее закрытие сегодняшней сессии (epoch, мс). */
function todayCloseEpoch(now: Date): number {
	const p = mskParts(now);
	return mskToEpoch(p.y, p.mo, p.d, CLOSE_MIN);
}

/* ─────────────────────── форматирование ─────────────────────── */

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

/** «1 дн. 07:03:27» — как на сайте MOEX. */
export function formatCountdown(ms: number): string {
	if (ms <= 0) return "00:00:00";
	const total = Math.floor(ms / 1000);
	const days = Math.floor(total / 86400);
	const rest = total % 86400;
	const h = Math.floor(rest / 3600);
	const m = Math.floor((rest % 3600) / 60);
	const s = rest % 60;
	const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
	return days > 0 ? `${days} дн. ${clock}` : clock;
}

function hhmm(minOfDay: number): string {
	return `${pad(Math.floor(minOfDay / 60))}:${pad(minOfDay % 60)}`;
}

function fmtSession(epoch: number): string {
	const p = mskParts(new Date(epoch));
	return `${WEEKDAYS_RU[p.dow]}, ${p.d} ${MONTHS_RU[p.mo]}, ${hhmm(OPEN_MIN)} МСК`;
}

function fmtClosedUntil(epoch: number): string {
	const p = mskParts(new Date(epoch));
	return `${p.d} ${MONTHS_RU[p.mo]}. ${hhmm(OPEN_MIN)}:00`;
}

/* ─────────────────────── главный расчёт ─────────────────────── */

/**
 * Статус торгов MOEX на заданный момент.
 * Считает локально по регламенту — работает и при закрытом рынке,
 * когда ISS API отдаёт пустые данные.
 */
export function getMarketClock(now: Date = new Date()): MarketClock {
	const p = mskParts(now);
	const openEpoch = nextOpenEpoch(now);
	const msToOpen = Math.max(0, openEpoch - now.getTime());
	const closeEpoch = todayCloseEpoch(now);
	const msToClose = Math.max(0, closeEpoch - now.getTime());

	const tradingDay = isTradingDay(p.y, p.mo, p.d);
	const holiday = holidayOf(p.y, p.mo, p.d);
	const tech = isTechWork(p.y, p.mo, p.d);
	const dow = p.dow;

	const base = {
		millisUntilOpen: msToOpen,
		millisUntilClose: 0,
		countdown: formatCountdown(msToOpen),
		nextSession: fmtSession(openEpoch),
		closedUntil: fmtClosedUntil(openEpoch),
	};

	/* ── Технические работы (день теста) ─────────────────────────── */
	if (tech) {
		return {
			...base,
			state: "closed-tech",
			label: "Технические работы",
			isTrading: false,
			advice:
				`Биржа закрыта на технические работы. Твой портфель в безопасности — ` +
				`торги возобновятся ${fmtSession(openEpoch)}. Отключи уведомления и не смотри на графики: ` +
				`лучшее решение сейчас — выспаться, а завтра начнём с чистого листа.`,
		};
	}

	/* ── Выходной ────────────────────────────────────────────────── */
	if (dow === 0 || dow === 6) {
		return {
			...base,
			state: "closed-weekend",
			label: "Выходной",
			isTrading: false,
			advice:
				`На бирже выходной — торги возобновятся ${fmtSession(openEpoch)}. ` +
				`Графики стоят, а жизнь идёт: это лучший момент для прогулки, кухни и семьи.`,
		};
	}

	/* ── Праздник ────────────────────────────────────────────────── */
	if (holiday) {
		return {
			...base,
			state: "closed-holiday",
			label: `Праздник: ${holiday}`,
			isTrading: false,
			advice:
				`Сегодня ${holiday} — MOEX закрыта до ${fmtSession(openEpoch)}. ` +
				`Отмечай спокойно, позиции подождут. Лучшая сделка дня — та, где ты не трейдил.`,
		};
	}

	/* ── Торговый день: смотрим на время ─────────────────────────── */
	if (tradingDay) {
		// Основная + вечерняя сессия: 06:50 – 23:50 МСК
		if (p.min >= OPEN_MIN && p.min < CLOSE_MIN) {
			// Последние 30 минут сессии
			if (msToClose <= 30 * 60_000) {
				return {
					...base,
					state: "closing-soon",
					label: "Скоро закрытие",
					isTrading: true,
					millisUntilClose: msToClose,
					countdown: formatCountdown(msToClose),
					advice:
						`До конца сессии ${formatCountdown(msToClose)}. Хорошее время подвести итоги дня ` +
						`и закрыть ноутбук — не открывай новых позиций на последней минуте.`,
				};
			}
			return {
				...base,
				state: "trading",
				label: "Торги идут",
				isTrading: true,
				millisUntilClose: msToClose,
				countdown: formatCountdown(msToClose),
				advice:
					"Рынок открыт, все системы в норме. Помни о риск-менеджменте: Колобок не торгует за тебя. " +
					"Если в плане на сегодня сделок нет — не выдумывай их.",
			};
		}

		// Премаркет: менее 60 минут до открытия
		if (p.min < OPEN_MIN && msToOpen <= 60 * 60_000) {
			return {
				...base,
				state: "premarket",
				label: "Скоро открытие",
				isTrading: false,
				advice:
					`До открытия ${formatCountdown(msToOpen)}. Успей выпить кофе — портфель готов. ` +
					"Проверь новости перед стартом: утро обычно даёт главную волатильность дня.",
			};
		}
	}

	/* ── Вне сессии (ночь или вечер после 23:50) ─────────────────── */
	return {
		...base,
		state: "closed-off-hours",
		label: "Вне сессии",
		isTrading: false,
		advice:
			`Сейчас вне торговой сессии — рынок спит до ${fmtSession(openEpoch)}. ` +
			"Не проверяй портфель каждую минуту: утром всё будет видно так же хорошо.",
	};
}
