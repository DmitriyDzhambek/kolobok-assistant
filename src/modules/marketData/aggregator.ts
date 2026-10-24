/**
 * MarketDataAggregator — сервис сбора и агрегации данных из внешних
 * источников для генерации ежедневных советов пользователю.
 *
 * Источники данных:
 *   1. Tinkoff Invest API  — портфель пользователя (GetPortfolio).
 *   2. MOEX ISS API        — рыночные данные по инструменту
 *      (https://iss.moex.com/iss/engines/futures/markets/forts/securities/SRZ5.json).
 *   3. Economic Calendar   — макроэкономические события (CIB/Trading Economics и т.п.).
 *
 * MVP-режим: все методы по умолчанию возвращают mock-данные (useMock: true),
 * поэтому код запускается без реальных ключей API. Реальные HTTP-вызовы
 * уже написаны (fetch + AbortController) и включаются флагом useMock: false.
 *
 * ВАЖНО для продакшена: класс должен исполнятьcя ТОЛЬКО на сервере
 * (Node-сервис / serverless-функция /api/*). Ключи не должны попадать
 * в браузерный бандл — см. раздел «Хранение ключей» в README модуля.
 */

/* ================================================================== */
/* ИНТЕРФЕЙСЫ ДАННЫХ                                                   */
/* ================================================================== */

export type InstrumentType = "future" | "stock" | "bond" | "currency";

/** Позиция в портфеле пользователя (эмуляция GetPortfolio Tinkoff API). */
export interface PortfolioPosition {
	/** Идентификатор инструмента FIGI (Tinkoff/MOEX). */
	figi: string;
	/** Тикер на бирже (для фьючерсов — код MOEX, напр. SRZ5). */
	ticker: string;
	instrumentType: InstrumentType;
	/** Количество контрактов/акций. */
	quantity: number;
	/** Средняя цена покупки. */
	avgPrice: number;
}

/** Портфель пользователя. */
export interface UserPortfolio {
	positions: PortfolioPosition[];
	/** Свободные денежные средства, ₽. */
	cashRub: number;
	currency: "RUB";
	fetchedAt: string;
}

/** Рыночные данные по инструменту (эмуляция MOEX ISS). */
export interface MarketData {
	ticker: string;
	lastPrice: number;
	prevPrice: number;
	/** Изменение к предыдущему закрытию, %. */
	changePercent: number;
	/** Дата экспирации фьючерса (ISO), для базовых активов — undefined. */
	expiryDate?: string;
	/** Дней до экспирации (округлено вверх). */
	daysToExpiry: number;
	/** Реализованная/оценённая годовая волатильность, %. */
	volatility: number;
	/** Объём торгов за сегодня, лотов. */
	volumeLots: number;
	fetchedAt: string;
}

export type EventImportance = "low" | "medium" | "high";

/** Событие экономического календаря. */
export interface EconomicEvent {
	id: string;
	title: string;
	country: string;
	importance: EventImportance;
	/** Время события, ISO-строка. */
	time: string;
	forecast?: string;
	previous?: string;
}

/* ================================================================== */
/* РЕЗУЛЬТАТ АГРЕГАЦИИ — СОВЕТ                                         */
/* ================================================================== */

export type AdviceAction =
	| "close"
	| "reduce"
	| "hold"
	| "hedge"
	| "set-stop"
	| "no-position"
	| "no-data";

export interface Advice {
	ticker: string;
	action: AdviceAction;
	urgency: "low" | "medium" | "high";
	/** Короткий заголовок для UI-плашки. */
	headline: string;
	/** Развёрнутый текст совета (готовится к озвучке Колобком). */
	text: string;
	/** Факторы, из которых сложен совет (объяснимость для пользователя). */
	factors: string[];
	/** Жив ли каждый из источников (для диагностики в UI). */
	sourcesOk: { portfolio: boolean; market: boolean; calendar: boolean };
	pnlPercent: number | null;
}

/* ================================================================== */
/* НАСТРОЙКИ КЛАССА                                                    */
/* ================================================================== */

export interface AggregatorOptions {
	/** true (default) — mock-данные; false — реальные HTTP-запросы. */
	useMock?: boolean;
	/** Токен Tinkoff Invest API (только на сервере!). */
	tinkoffToken?: string;
	/** https://invest-public-api.tinkoff.ru/rest (или sandbox-url для тестов). */
	tinkoffBaseUrl?: string;
	/** https://iss.moex.com/iss — ключа не требует. */
	moexBaseUrl?: string;
	/** URL API экономического календаря + ключ провайдера. */
	calendarUrl?: string;
	calendarApiKey?: string;
	/** Таймаут сетевого запроса, мс. */
	timeoutMs?: number;
}

const DEFAULTS: Required<Omit<AggregatorOptions, "tinkoffToken" | "calendarApiKey">> = {
	useMock: true,
	tinkoffBaseUrl: "https://invest-public-api.tinkoff.ru/rest",
	moexBaseUrl: "https://iss.moex.com/iss",
	calendarUrl: "https://api.econ-calendar.example/v1/events",
	timeoutMs: 8000,
};

/* ================================================================== */
/* MOCK-ДАННЫЕ (примеры заглушек)                                      */
/* ================================================================== */

/** Дата «через N дней» в ISO — чтобы mock был всегда «свежим». */
function isoDaysFromNow(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString();
}

export const MOCK_PORTFOLIO: UserPortfolio = {
	positions: [
		{
			figi: "SI1GUZ000032", // фьючерс на индекс РТС
			ticker: "SRZ5",
			instrumentType: "future",
			quantity: 3,
			avgPrice: 2480.0,
		},
		{
			figi: "SI1GZBS007N4", // фьючерс на нефть Brent
			ticker: "BRQ5",
			instrumentType: "future",
			quantity: 2,
			avgPrice: 82.5,
		},
		{
			figi: "BBM000000004", // акции Сбербанка
			ticker: "SBER",
			instrumentType: "stock",
			quantity: 100,
			avgPrice: 265.4,
		},
	],
	cashRub: 145_300,
	currency: "RUB",
	fetchedAt: new Date().toISOString(),
};

export function mockMarketData(ticker: string): MarketData {
	const t = ticker.toUpperCase();
	const presets: Record<string, Partial<MarketData>> = {
		SRZ5: {
			lastPrice: 2612.4,
			prevPrice: 2588.0,
			expiryDate: isoDaysFromNow(2), // через 2 дня → срабатывает правило экспирации
			volatility: 41.5, // высокая волатильность
			volumeLots: 154_230,
		},
		BRQ5: {
			lastPrice: 79.1,
			prevPrice: 81.4,
			expiryDate: isoDaysFromNow(18),
			volatility: 55.2,
			volumeLots: 98_100,
		},
		SBER: {
			lastPrice: 271.8,
			prevPrice: 270.1,
			volatility: 22.4,
			volumeLots: 412_800,
		},
	};
	const p = presets[t] ?? {
		lastPrice: 100,
		prevPrice: 99.5,
		volatility: 25,
		volumeLots: 10_000,
	};
	const lastPrice = p.lastPrice ?? 0;
	const prevPrice = p.prevPrice ?? lastPrice;
	return {
		ticker: t,
		lastPrice,
		prevPrice,
		changePercent: +(((lastPrice - prevPrice) / prevPrice) * 100).toFixed(2),
		expiryDate: p.expiryDate,
		daysToExpiry: p.expiryDate ? daysBetweenNow(p.expiryDate) : Infinity,
		volatility: p.volatility ?? 25,
		volumeLots: p.volumeLots ?? 0,
		fetchedAt: new Date().toISOString(),
	};
}

export const MOCK_ECONOMIC_EVENTS: EconomicEvent[] = [
	{
		id: "evt-cb-rates",
		title: "Заседание ЦБ РФ по ключевой ставке",
		country: "RU",
		importance: "high",
		time: isoDaysFromNow(0.3), // сегодня через ~7 часов
		forecast: "16.0%",
		previous: "16.0%",
	},
	{
		id: "evt-us-pce",
		title: "Индекс цен расходов на потребление (PCE), США",
		country: "US",
		importance: "medium",
		time: isoDaysFromNow(1),
		forecast: "2.6%",
		previous: "2.5%",
	},
	{
		id: "evt-opec",
		title: "Отчёт ОПЕК по рынку нефти",
		country: "GLOBAL",
		importance: "high",
		time: isoDaysFromNow(2),
	},
];

/* ================================================================== */
/* ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ                                             */
/* ================================================================== */

/** Дней «от сейчас» до ISO-даты, округление вверх. */
export function daysBetweenNow(iso: string): number {
	const ms = new Date(iso).getTime() - Date.now();
	return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** fetch с таймаутом; бросает ошибку при network/HTTP-проблеме. */
async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
	const ctl = new AbortController();
	const timer = setTimeout(() => ctl.abort(), timeoutMs);
	try {
		const r = await fetch(url, { ...init, signal: ctl.signal });
		if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
		return await r.json();
	} finally {
		clearTimeout(timer);
	}
}

/* ================================================================== */
/* КЛАСС MarketDataAggregator                                          */
/* ================================================================== */

export class MarketDataAggregator {
	private readonly opts: typeof DEFAULTS & Pick<AggregatorOptions, "tinkoffToken" | "calendarApiKey">;

	constructor(options: AggregatorOptions = {}) {
		this.opts = { ...DEFAULTS, ...options };
	}

	/* ---------------- 1. Портфель: Tinkoff Invest API ---------------- */

	/**
	 * Эмуляция Tinkoff Invest `Portfolio` (gRPC/REST endpoint
	 * /Tinkoff.InvestApi.V1.InvestApi/Portfolio с Authorization: Bearer <token>).
	 */
	async getUserPortfolio(): Promise<UserPortfolio> {
		if (this.opts.useMock) return structuredCloneSafe(MOCK_PORTFOLIO);

		const token = this.opts.tinkoffToken ?? process.env.TINKOFF_INVEST_TOKEN;
		if (!token) throw new Error("TINKOFF_INVEST_TOKEN не задан");

		const json = await fetchJson(
			`${this.opts.tinkoffBaseUrl}/Tinkoff.InvestApi.V1.InvestApi/Portfolio`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({}),
			},
			this.opts.timeoutMs,
		);

		// Ответ REST TinkoffcamelCase: positions[] {figi, quantity, positionPrice...}
		return {
			positions: (json.positions ?? []).map((p: any) => ({
				figi: String(p.figi ?? ""),
				ticker: String(p.figi ?? p.instrumentType ?? "UNKNOWN"),
				instrumentType: mapTinkoffType(p.instrumentType),
				quantity: Number(p.quantity ?? 0),
				// positionPrice — в копейках/минимальных единицах; делим на 100 для ₽-инструментов
				avgPrice: Number(p.positionPrice?.units ?? p.averageMonthlyIncome ?? 0) +
					Number(p.positionPrice?.nano ?? 0) / 1e9,
			})),
			cashRub: Number(json.cash?.units ?? json.cash ?? 0),
			currency: "RUB",
			fetchedAt: new Date().toISOString(),
		};
	}

	/* ---------------- 2. Рынок: MOEX ISS API ---------------- */

	/**
	 * Реальный endpoint не требует ключа:
	 * GET https://iss.moex.com/iss/engines/futures/markets/forts/securities/SRZ5.json
	 * (для акций — engines/stock/markets/shares/securities/SBER.json)
	 */
	async getMarketData(ticker: string): Promise<MarketData> {
		if (this.opts.useMock) return mockMarketData(ticker);

		const t = ticker.toUpperCase();
		const json = await fetchJson(
			`${this.opts.moexBaseUrl}/engines/futures/markets/forts/securities/${encodeURIComponent(t)}.json` +
				`?iss.meta=off&iss.only=marketdata,securities`,
			{ headers: { Accept: "application/json" } },
			this.opts.timeoutMs,
		);

		const md = json?.marketdata?.data?.[0];
		const sec = json?.securities?.data?.[0];
		if (!md) throw new Error(`MOEX ISS: нет marketdata по ${t}`);

		const lastPrice = Number(md.LAST ?? md.WAPRICE ?? 0);
		const prevPrice = Number(md.PREVPRICE ?? lastPrice);
		const expiry: string | undefined = sec?.NEXT_EXPIRY ?? sec?.PREVIOUS_EXPIRY;
		// MVP-эвристика: годовая волатильность ≈ дневное изменение × √252.
		const changePercent = prevPrice ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;

		return {
			ticker: t,
			lastPrice,
			prevPrice,
			changePercent: +changePercent.toFixed(2),
			expiryDate: expiry,
			daysToExpiry: expiry ? daysBetweenNow(expiry) : Infinity,
			volatility: +(Math.abs(changePercent) * Math.sqrt(252)).toFixed(1),
			volumeLots: Number(md.VOLUME ?? 0),
			fetchedAt: new Date().toISOString(),
		};
	}

	/* ---------------- 3. Экономический календарь ---------------- */

	async getEconomicCalendar(): Promise<EconomicEvent[]> {
		if (this.opts.useMock) return structuredCloneSafe(MOCK_ECONOMIC_EVENTS);

		const key = this.opts.calendarApiKey ?? process.env.ECON_CALENDAR_API_KEY;
		if (!key) throw new Error("ECON_CALENDAR_API_KEY не задан");

		const json = await fetchJson(
			`${this.opts.calendarUrl}?key=${encodeURIComponent(key)}&country=RU,US&horizon=72h`,
			{ headers: { Accept: "application/json" } },
			this.opts.timeoutMs,
		);

		return (json.events ?? []).map((e: any) => ({
			id: String(e.id),
			title: String(e.name ?? e.title),
			country: String(e.country ?? "GLOBAL"),
			importance: normalizeImportance(e.importance ?? e.impact),
			time: String(e.date ?? e.time),
			forecast: e.forecast != null ? String(e.forecast) : undefined,
			previous: e.previous != null ? String(e.previous) : undefined,
		}));
	}
}

function mapTinkoffType(t: unknown): InstrumentType {
	const s = String(t ?? "").toLowerCase();
	if (s.includes("future")) return "future";
	if (s.includes("stock")) return "stock";
	if (s.includes("bond")) return "bond";
	if (s.includes("currency")) return "currency";
	return "stock";
}

function normalizeImportance(v: unknown): EventImportance {
	const s = String(v ?? "").toLowerCase();
	if (s.includes("high") || s === "3" || s === "🔴" || s.includes("red")) return "high";
	if (s.includes("med") || s === "2" || s.includes("yellow")) return "medium";
	return "low";
}

function structuredCloneSafe<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T;
}

/* ================================================================== */
/* ГЛАВНАЯ ФУНКЦИЯ: generateAdvice                                     */
/* ================================================================== */

/**
 * Собирает данные из трёх источников и по простым правилам выдаёт совет.
 *
 * Устойчивость: каждый источник запрашивается «best effort» —
 * если один API лёг, совет строится по оставшимся данным,
 * а в sourcesOk честно отражается статус.
 */
export async function generateAdvice(
	ticker: string,
	aggregator: MarketDataAggregator = new MarketDataAggregator(),
): Promise<Advice> {
	const t = ticker.toUpperCase();

	// Promise.allSettled — падение одного источника не роняет весь совет.
	const [portfolioRes, marketRes, calendarRes] = await Promise.allSettled([
		aggregator.getUserPortfolio(),
		aggregator.getMarketData(t),
		aggregator.getEconomicCalendar(),
	]);

	const portfolio = portfolioRes.status === "fulfilled" ? portfolioRes.value : null;
	const market = marketRes.status === "fulfilled" ? marketRes.value : null;
	const events = calendarRes.status === "fulfilled" ? calendarRes.value : [];

	const sourcesOk = {
		portfolio: portfolio !== null,
		market: market !== null,
		calendar: calendarRes.status === "fulfilled",
	};

	// Логируем упавшие источники (в проде — в Sentry/структурный лог).
	if (portfolioRes.status === "rejected")
		console.warn("[aggregator] портфель недоступен:", portfolioRes.reason?.message ?? portfolioRes.reason);
	if (marketRes.status === "rejected")
		console.warn("[aggregator] MOEX недоступна:", marketRes.reason?.message ?? marketRes.reason);
	if (calendarRes.status === "rejected")
		console.warn("[aggregator] календарь недоступен:", calendarRes.reason?.message ?? calendarRes.reason);

	const base: Omit<Advice, "action" | "urgency" | "headline" | "text" | "factors" | "pnlPercent"> = {
		ticker: t,
		sourcesOk,
	};

	/* --- Нет данных портфеля → нечего советовать --- */
	if (!portfolio) {
		return {
			...base,
			action: "no-data",
			urgency: "low",
			headline: "📡 Нет данных портфеля",
			text: "Колобок не смог заглянуть в портфель — проверь соединение или токен и попробуй ещё разок.",
			factors: ["Источник «Tinkoff Invest API» недоступен"],
			pnlPercent: null,
		};
	}

	const position = portfolio.positions.find((p) => p.ticker.toUpperCase() === t);
	if (!position) {
		return {
			...base,
			action: "no-position",
			urgency: "low",
			headline: `🤷 ${t}: такой позиции нет`,
			text: `В твоём портфеле инструмента ${t} не нашлось. Взгляни на список позиций — может, тикер другой?`,
			factors: ["Позиция по тикеру не найдена"],
			pnlPercent: null,
		};
	}

	const factors: string[] = [];

	/* PnL позиции (если есть рыночная цена) */
	let pnlPercent: number | null = null;
	if (market) {
		pnlPercent = +(((market.lastPrice - position.avgPrice) / position.avgPrice) * 100).toFixed(2);
		factors.push(
			`Позиция: ${position.quantity} × ${t} по средней ${position.avgPrice}, сейчас ${market.lastPrice} → ${pnlPercent >= 0 ? "+" : ""}${pnlPercent}%`,
		);
	} else {
		factors.push("Текущая цена недоступна — считаем только по календарю и экспирации");
	}

	if (market) {
		factors.push(`Волатильность ${market.volatility}% годовых, изменение за день ${market.changePercent >= 0 ? "+" : ""}${market.changePercent}%`);
		if (market.expiryDate) {
			factors.push(`Экспирация ${market.expiryDate.slice(0, 10)} — через ${market.daysToExpiry} дн.`);
		}
	}

	/* Ближайшее высоковажное событие (в течение 24 часов) */
	const hotEvent = events
		.filter((e) => e.importance === "high" && new Date(e.time).getTime() - Date.now() <= 86_400_000 && new Date(e.time).getTime() >= Date.now() - 3_600_000)
		.sort((a, b) => +new Date(a.time) - +new Date(b.time))[0];
	if (hotEvent) {
		factors.push(`Через ${Math.round((+new Date(hotEvent.time) - Date.now()) / 3_600_000)} ч — «${hotEvent.title}» (важность: высокая)`);
	}

	/* ---------------- ПРАВИЛА (по убыванию приоритета) ---------------- */

	const HIGH_VOL = 35; // % годовых
	const STOP_LOSS = -7; // % по позиции

	// Правило 1: экспирация близко + высокая волатильность → закрывать.
	if (market && market.daysToExpiry <= 2 && market.volatility >= HIGH_VOL) {
		return {
			...base,
			action: "close",
			urgency: "high",
			headline: `🚨 ${t}: закрывай до экспирации`,
			text:
				`До экспирации ${position.instrumentType === "future" ? "фьючерса" : "инструмента"} ${t} меньше двух дней, ` +
				`а волатильность ${market.volatility}% — на этой неделе контракт будет перенесён, ` +
				`и тело позиции (гарантийное обеспечение) заморозят. Рекомендую закрыть позицию до 18:00 сегодня ` +
				`и при желании открыть ближайший дальний контракт. Ты отдыхай, а нервы береги!`,
			factors,
			pnlPercent,
		};
	}

	// Правило 2: просадка позиции глубже стоп-линии → стоп/сокращение.
	if (pnlPercent !== null && pnlPercent <= STOP_LOSS) {
		return {
			...base,
			action: "reduce",
			urgency: "high",
			headline: `🛑 ${t}: сработал дисциплина-стоп`,
			text:
				`Позиция ${t} в просадке ${pnlPercent}% — это глубже твоего стоп-уровня ${STOP_LOSS}%. ` +
				`Рекомендую сократить не менее чем наполовину и выставить жёсткий стоп-заявку по остатку. ` +
				`Надежда «отскочит» — самый дорогой Trader's friend.`,
			factors,
			pnlPercent,
		};
	}

	// Правило 3: горячее макро-событие в ближайшие 24 ч → защита позиции.
	if (hotEvent) {
		const losing = pnlPercent !== null && pnlPercent < 0;
		return {
			...base,
			action: losing ? "set-stop" : "hedge",
			urgency: "medium",
			headline: `🌪 ${t}: перед событием берегись`,
			text: losing
				? `Сегодня «${hotEvent.title}» — возможны резкие движения. Позиция ${t} и так в минусе (${pnlPercent}%): выставь стоп-заявку, чтобы событие не решило за тебя.`
				: `Сегодня «${hotEvent.title}». Позиция ${t} в плюсе (${pnlPercent}%): рассмотрей хедж или перенос стопа в безубыток — дай прибыли «подышать», но не отдай её за час новостей.`,
			factors,
			pnlPercent,
		};
	}

	// Правило 4: экспирация близко, но волатильность спокойная → перенос.
	if (market && position.instrumentType === "future" && market.daysToExpiry <= 7) {
		return {
			...base,
			action: "reduce",
			urgency: "medium",
			headline: `📅 ${t}: время думать о переносе`,
			text:
				`Экспирация ${t} через ${market.daysToExpiry} дн. Волатильность спокойная (${market.volatility}%), ` +
				`но плечо лучше перенести заранее: закрой ближний и открой дальний контракт, ` +
				`чтобы не толкаться в зоне экспирации.`,
			factors,
			pnlPercent,
		};
	}

	// Правило 5: прибыль + низкая волатильность → держать, стоп в безубыток.
	if (pnlPercent !== null && pnlPercent > 5 && (market?.volatility ?? 0) < HIGH_VOL) {
		return {
			...base,
			action: "hold",
			urgency: "low",
			headline: `✅ ${t}: перенеси стоп в безубыток`,
			text:
				`${t} в плюсе на ${pnlPercent}%, рынок спокоен. Ничего не продаём в панике — ` +
				`но перенесём стоп-заявку в район цены покупки: худшее, что случилось, уже не случится.`,
			factors,
			pnlPercent,
		};
	}

	// Правило 6: тишина — плановое наблюдение.
	return {
		...base,
		action: "hold",
		urgency: "low",
		headline: `🙂 ${t}: суета не нужна`,
		text:
			`По позиции ${t} триггеров нет: экспирация не горит, новостей-бомб рядом ${hotEvent ? "нет" : "не видно"}, ` +
			`волатильность в норме. План на день — заниматься собой, а портфель посмотрим вечером.`,
		factors,
		pnlPercent,
	};
}
