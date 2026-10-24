/**
 * Модуль Computer Vision для парсинга скриншотов портфеля Тинькофф.
 * 
 * В MVP используется mock-режим (заглушка). В продакшене здесь будет:
 * - Tesseract OCR для распознавания цифр
 * - OpenCV для анализа графиков
 * - ML-модель для классификации элементов UI
 */

export interface TinkoffPortfolioData {
  /** Общий баланс портфеля */
  balance: number;
  /** PnL за день (прибыль/убыток) */
  pnl: number;
  /** PnL в процентах */
  pnlPercent: number;
  /** Фьючерсные позиции */
  futures: FuturesPosition[];
  /** Акции */
  stocks: StockPosition[];
  /** Дата скриншота */
  screenshotDate: string;
}

export interface FuturesPosition {
  ticker: string;
  direction: 'long' | 'short';
  expiry: string;
  marginRisk: number; // % использования маржи
  currentPnl: number;
  stopLoss?: number;
}

export interface StockPosition {
  ticker: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

export interface PortfolioAnalysis {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  mood: 'party' | 'focus' | 'cautious';
  stressScore: number; // 0-100
}

/**
 * Mock-функция парсинга скриншота портфеля.
 * В продакшене заменится на реальный CV-пайплайн.
 */
export async function parsePortfolioScreenshot(
  file: File
): Promise<TinkoffPortfolioData> {
  // Имитация задержки OCR-обработки
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Mock-данные (в продакшене — результат анализа изображения)
  return {
    balance: 1250000,
    pnl: -45000,
    pnlPercent: -3.5,
    screenshotDate: new Date().toISOString().split('T')[0],
    futures: [
      {
        ticker: 'Si-3.24',
        direction: 'long',
        expiry: '2024-03-24',
        marginRisk: 78,
        currentPnl: -15000,
        stopLoss: 89.5,
      },
      {
        ticker: 'BRU-3.24',
        direction: 'short',
        expiry: '2024-03-24',
        marginRisk: 45,
        currentPnl: 10000,
      },
    ],
    stocks: [
      {
        ticker: 'SBER',
        shares: 100,
        avgPrice: 265,
        currentPrice: 258,
        pnl: -7000,
      },
      {
        ticker: 'GAZP',
        shares: 200,
        avgPrice: 178,
        currentPrice: 182,
        pnl: 8000,
      },
    ],
  };
}

/**
 * Анализ рисков портфеля
 */
export function analyzePortfolioRisk(
  data: TinkoffPortfolioData
): PortfolioAnalysis {
  const riskFactors: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let stressScore = 0;

  // Анализ PnL
  if (data.pnlPercent < -5) {
    riskFactors.push('Большая просадка (>5%)');
    stressScore += 40;
  } else if (data.pnlPercent < -2) {
    riskFactors.push('Умеренная просадка');
    stressScore += 20;
  } else if (data.pnlPercent > 3) {
    riskFactors.push('Отличный день! 🎉');
    stressScore -= 20;
  }

  // Анализ фьючерсов
  const highRiskFutures = data.futures.filter((f) => f.marginRisk > 70);
  if (highRiskFutures.length > 0) {
    riskFactors.push(
      `Высокий риск по фьючерсам: ${highRiskFutures.map((f) => f.ticker).join(', ')}`
    );
    stressScore += 30;
  }

  const losingFutures = data.futures.filter((f) => f.currentPnl < 0);
  if (losingFutures.length > data.futures.length / 2) {
    riskFactors.push('Большинство фьючерсов в минусе');
    stressScore += 15;
  }

  // Определение уровня риска
  if (stressScore >= 60) {
    riskLevel = 'critical';
  } else if (stressScore >= 40) {
    riskLevel = 'high';
  } else if (stressScore >= 20) {
    riskLevel = 'medium';
  }

  // Рекомендации
  const recommendations: string[] = [];
  if (riskLevel === 'critical') {
    recommendations.push('Снизить риски: закрыть часть фьючерсов');
    recommendations.push('Взять день отдыха');
    recommendations.push('Не принимать финансовых решений сегодня');
  } else if (riskLevel === 'high') {
    recommendations.push('Пересмотреть позиции по фьючерсам');
    recommendations.push('Добавить блок отдыха в расписание');
  } else if (data.pnlPercent > 3) {
    recommendations.push('Отличный день! Зафиксируйте прибыль');
    recommendations.push('Позаботьтесь о себе — вы заслужили');
  }

  // Определение настроения
  let mood: 'party' | 'focus' | 'cautious' = 'cautious';
  if (data.pnlPercent > 3 && riskLevel === 'low') {
    mood = 'party';
  } else if (riskLevel === 'critical' || riskLevel === 'high') {
    mood = 'focus';
  }

  return {
    riskLevel,
    recommendations,
    mood,
    stressScore: Math.max(0, Math.min(100, stressScore)),
  };
}
