/**
 * Быстрая проверка marketClock против данных сайта MOEX (скриншот 24.10.2026):
 *   «Торги не идут. До открытия: 1 дн. 07:03:27. Закрыто до: 26 окт. 06:50:00»
 */
import { getMarketClock, formatCountdown } from "../src/modules/advisory/marketClock";

/** Момент по МСК → epoch (без зависимости от зоны машины). */
const msk = (y: number, mo: number, d: number, h: number, mi: number, s = 0) =>
	new Date(Date.UTC(y, mo - 1, d, h, mi, s) - 3 * 3_600_000);

const cases: Array<[string, Date, string]> = [
	["24.10.2026 23:46 (скриншот MOEX)", msk(2026, 10, 24, 23, 46, 27), "1 дн. 07:03:33"],
	["пт 23.10.2026 20:00 (вечерняя сессия)", msk(2026, 10, 23, 20, 0), "03:50:00 (до закрытия)"],
	["пт 23.10.2026 12:00 (основная сессия)", msk(2026, 10, 23, 12, 0), "11:50:00 (до закрытия)"],
	["вс 25.10.2026 12:00 (выходной)", msk(2026, 10, 25, 12, 0), "18:50:00 (до открытия)"],
	["пн 26.10.2026 06:20 (премаркет)", msk(2026, 10, 26, 6, 20), "00:30:00 (до открытия)"],
	["пн 26.10.2026 12:00 (сессия)", msk(2026, 10, 26, 12, 0), "11:50:00 (до закрытия)"],
	["ср 31.12.2026 23:00 (перед каникулами)", msk(2026, 12, 31, 23, 0), "00:50:00, открытие 11 янв"],
];

console.log("=".repeat(78));
for (const [title, when, expect] of cases) {
	const c = getMarketClock(when);
	console.log(`\n${title}`);
	console.log(`  состояние   : ${c.state}  (${c.label})`);
	console.log(`  торги       : ${c.isTrading ? "идут" : "нет"}`);
	console.log(`  отсчёт      : ${c.countdown}`);
	console.log(`  открытие    : ${c.nextSession}`);
	console.log(`  закрыто до  : ${c.closedUntil || "—"}`);
	console.log(`  ожидали     : ${expect}`);
}

console.log("\n" + "=".repeat(78));
// 1 дн. 07:03:27 = 111 807 000 мс
console.log("Формат отсчёта:", formatCountdown(111_807_000), "(ожидалось: 1 дн. 07:03:27)");
