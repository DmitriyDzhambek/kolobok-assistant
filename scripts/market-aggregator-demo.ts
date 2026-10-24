/**
 * Демонстрация MarketDataAggregator + generateAdvice (mock-режим).
 *
 * Запуск:  npx tsx scripts/market-aggregator-demo.ts
 *
 * Показывает три сценария:
 *   1. SRZ5  — экспирация через 2 дня + высокая волатильность → «закрой».
 *   2. SBER  — прибыль, спокойный рынок → «держать / стоп в безубыток».
 *   3. GAZP  — позиции нет в портфеле → честный ответ «no-position».
 *   4. Упавший источник (useMock:false без ключей) → совет строится без паники.
 */

import { MarketDataAggregator, generateAdvice } from "../src/modules/marketData/aggregator";

async function main() {
	const agg = new MarketDataAggregator({ useMock: true });

	for (const ticker of ["SRZ5", "SBER", "GAZP"]) {
		const advice = await generateAdvice(ticker, agg);
		console.log("═".repeat(64));
		console.log(`💡 ${advice.headline}   [action=${advice.action}, urgency=${advice.urgency}]`);
		console.log(`   ${advice.text}`);
		console.log("   Факторы:");
		for (const f of advice.factors) console.log(`     • ${f}`);
		console.log(`   Источники: ${JSON.stringify(advice.sourcesOk)}`);
	}

	// Сценарий «все API легли»: реальный режим без ключей → no-data, но без падения.
	console.log("═".repeat(64));
	const brokenAgg = new MarketDataAggregator({ useMock: false });
	const advice = await generateAdvice("SRZ5", brokenAgg);
	console.log(`🧪 API без ключей → [action=${advice.action}] ${advice.headline}`);
	console.log(`   ${advice.text}`);
	console.log(`   Источники: ${JSON.stringify(advice.sourcesOk)}`);
}

void main();
