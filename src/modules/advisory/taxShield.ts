/**
 * Advisory Mode — «Налоговый щит» (ЛДВ).
 *
 * Колобок НЕ торгует за пользователя. Он только считает, когда выгодно
 * закрыть позицию с точки зрения льготы долгосрочного владения (ЛДВ, ст. 219.1 НК РФ):
 * если актив держится >= 3 лет, НДФЛ 13% с прибыли не взимается.
 *
 * Логика тревоги: если до 3-летия владения осталось < 2 месяцев, а позиция
 * уже в прибыли — продажа сейчас = подарок государству.
 */

/** Порог ЛДВ: 3 года владения. */
const LDV_YEARS = 3;
/** За сколько месяцев до ЛДВ бить тревогу. */
const ALERT_MONTHS = 2;
/** Ставка НДФЛ на прибыль от продажи ценных бумаг (РФ). */
const NDFL_RATE = 0.13;

export type TaxShieldStatus = "safe" | "warning" | "urgent";

export interface TaxShieldPosition {
	ticker: string;
	/** Дата приобретения позиции (ISO). */
	heldSince: string;
	/** Текущая нереализованная прибыль позиции, ₽. */
	pnl: number;
}

export interface TaxShieldResult {
	status: TaxShieldStatus;
	/** Позиция с самым близким ЛДВ-дедлайном. */
	position: TaxShieldPosition;
	/** Сколько месяцев осталось до ЛДВ (0 = льгота уже доступна). */
	monthsToLdv: number;
	/** Полное описание срока: «2 года 10 месяцев». */
	heldLabel: string;
	/** Сумма НДФЛ, которой пользователь «пожертвует» при продаже сейчас. */
	ndflAtRisk: number;
	/** Готовый текст совета от Колобка. */
	advice: string;
}

/** Разница между двумя датами в месяцах (целая часть). */
function monthsBetween(from: Date, to: Date): number {
	return (
		(to.getFullYear() - from.getFullYear()) * 12 +
		(to.getMonth() - from.getMonth()) +
		(to.getDate() >= from.getDate() ? 0 : -1)
	);
}

function humanizeDuration(months: number): string {
	const y = Math.floor(months / 12);
	const m = months % 12;
	if (y === 0) return m === 1 ? "1 месяц" : m < 5 ? `${m} месяца` : `${m} месяцев`;
	const yLabel = y === 1 ? "1 год" : y < 5 ? `${y} года` : `${y} лет`;
	return m === 0 ? yLabel : `${yLabel} и ${m} мес.`;
}

const fmt = (n: number) =>
	Math.round(n).toLocaleString("ru-RU");

/**
 * Анализ одной позиции на предмет ЛДВ-ловушки.
 * Возвращает null, если позиция ещё далеко от 3-летнего порога
 * (тревога не нужна) или в убытке (ЛДВ не спасает).
 */
export function analyzeTaxShield(
	position: TaxShieldPosition,
	now: Date = new Date()
): TaxShieldResult | null {
	const held = new Date(position.heldSince);
	if (isNaN(held.getTime())) return null;

	const heldMonths = monthsBetween(held, now);
	const monthsToLdv = LDV_YEARS * 12 - heldMonths;

	// ЛДВ уже наступила — продавать можно без налога.
	if (monthsToLdv <= 0) {
		return {
			status: "safe",
			position,
			monthsToLdv: 0,
			heldLabel: humanizeDuration(heldMonths),
			ndflAtRisk: 0,
			advice: `Ты держишь ${position.ticker} уже ${humanizeDuration(
				heldMonths
			)} — льгота долгосрочного владения активна. Продавать можно без НДФЛ: вся прибыль ${fmt(
				position.pnl
			)} ₽ остаётся тебе.`,
		};
	}

	// Тревожимся только если льгота близко И позиция в прибыли.
	const closeToLdv = monthsToLdv <= ALERT_MONTHS;
	const profitable = position.pnl > 0;
	if (!closeToLdv || !profitable) return null;

	const ndflAtRisk = Math.round(position.pnl * NDFL_RATE);
	return {
		status: monthsToLdv <= 1 ? "urgent" : "warning",
		position,
		monthsToLdv,
		heldLabel: humanizeDuration(heldMonths),
		ndflAtRisk,
		advice: `Внимание! Ты владеешь ${position.ticker} уже ${humanizeDuration(
			heldMonths
		)}. Если продашь сейчас — заплатишь 13% НДФЛ (${fmt(
			ndflAtRisk
		)} ₽). Подожди ${monthsToLdv} мес. до льготы долгосрочного владения, и государство оставит тебе эти деньги.`,
	};
}

/**
 * Поиск «самой налоговой ловушки» среди акций портфеля.
 * Возвращает худший (urgent > warning) случай или null.
 */
export function findTaxTrap(
	positions: TaxShieldPosition[],
	now: Date = new Date()
): TaxShieldResult | null {
	const results = positions
		.map((p) => analyzeTaxShield(p, now))
		.filter((r): r is TaxShieldResult => r !== null);

	if (results.length === 0) return null;
	results.sort((a, b) => {
		const rank = { urgent: 0, warning: 1, safe: 2 };
		return rank[a.status] - rank[b.status] || a.monthsToLdv - b.monthsToLdv;
	});
	return results[0];
}
