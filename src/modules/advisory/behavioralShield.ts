/**
 * Advisory Mode — «Спасение от паники» (Behavioral Shield).
 *
 * Поведенческий фильтр: на просадках инвесторы продают в худший момент.
 * Колобок проверяет: просадка в пределах нормальной коррекции?
 * активы фундаментально надежные (голубые фишки, нет плеча на грани)?
 * Если да — рекомендация НЕ продавать, а «заморозить панику»:
 * убрать котировки с глаз, включить спокойный звук, дышать.
 *
 * Никаких торговых кнопок — только текст + релакс-режим.
 */

import type { TinkoffPortfolioData } from "../portfolio/parser";

export type PanicLevel = "calm" | "watch" | "shield" | "danger";

export interface BehavioralShieldResult {
	level: PanicLevel;
	/** Заголовок карточки. */
	title: string;
	/** Текст совета Колобка. */
	advice: string;
	/** Включать ли релакс-режим (белый шум / таймер дыхания). */
	relaxMode: boolean;
}

/** Просадка, в которойhistorically не стоит продавать качественные активы. */
const NORMAL_CORRECTION_PCT = -8;
/** Просадка, при которой уже нужно реально снижать риск. */
const DANGER_PCT = -15;

/** «Голубые фишки» — фундаментально надежные бумаги для MVP-списка. */
const BLUE_CHIPS = new Set([
	"SBER", "GAZP", "LKOH", "RNFT", "GMTK", "TRNFP",
	"MTSS", "MGNT", "PHOR", "IRAO", "SNGS", "TATN", "GMKN", "ROSN", "YDEX",
]);

export function analyzePanicRisk(
	portfolio: TinkoffPortfolioData
): BehavioralShieldResult {
	const pnlPct = portfolio.pnlPercent;

	// ── Просадка в пределах нормы → щит активен ────────────────────
	if (pnlPct <= NORMAL_CORRECTION_PCT && pnlPct > DANGER_PCT) {
		const total = portfolio.stocks.length;
		const blueCount = portfolio.stocks.filter((s) =>
			BLUE_CHIPS.has(s.ticker.toUpperCase())
		).length;
		const qualityShare = total > 0 ? blueCount / total : 0.5;
		const hasMarginRisk = portfolio.futures.some((f) => f.marginRisk > 85);

		// Качественный портфель без маржинального риска → «не продавай».
		if (qualityShare >= 0.5 && !hasMarginRisk) {
			return {
				level: "shield",
				title: "🛡️ Спасение от паники",
				advice: `Портфель просел на ${Math.abs(pnlPct).toFixed(1)}%. Это нормальная рыночная коррекция: ${blueCount} из ${total} бумаг — голубые фишки, а плечо под контролем. Исторически рынок всегда восстанавливался. Не продавай в минус. Я включил для тебя успокаивающий белый шум — отойди от экрана на 10 минут.`,
				relaxMode: true,
			};
		}

		// Просадка + мусор/плечо → честно предупреждаем.
		return {
			level: "danger",
			title: "⚠️ Просадка требует внимания",
			advice: `Просадка ${Math.abs(pnlPct).toFixed(1)}% и высокий риск по позициям. Это не паника, а сигнал: пересмотри размер позиций и стопы. Но решения принимай на холодную голову — не сегодня вечером.`,
			relaxMode: false,
		};
	}

	// ── Опасная зона ───────────────────────────────────────────────
	if (pnlPct <= DANGER_PCT) {
		return {
			level: "danger",
			title: "🚨 Красная зона",
			advice: `Просадка ${Math.abs(pnlPct).toFixed(1)}% — это за пределами обычной коррекции. План: зафиксировать убыток по худшим позициям, снизить плечо, сделать паузу. Колобок не продаёт за тебя — но напомнит, что рынок выживает только трезвая голова.`,
			relaxMode: false,
		};
	}

	// ── Лёгкое снижение — наблюдение ──────────────────────────────
	if (pnlPct < 0) {
		return {
			level: "watch",
			title: "👀 Тихое наблюдение",
			advice: `Небольшое снижение (${pnlPct.toFixed(1)}%) — рабочий фон. Торгов по плану нет, значит действий нет. Лучшее решение на такие дни — не мешать портфелю.`,
			relaxMode: false,
		};
	}

	// ── В плюсе ────────────────────────────────────────────────────
	return {
		level: "calm",
		title: "😌 Всё ровно",
		advice:
			"Портфель в плюсе или на месте — поводов для тревоги нет. Наслаждайся днём, Колобок следит за рынком вместо тебя.",
		relaxMode: false,
	};
}
