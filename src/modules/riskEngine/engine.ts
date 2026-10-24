/**
 * Risk-to-Life Engine — ядро Orchestrator'а.
 *
 * Превращает финансовые риски в конкретные жизненные решения:
 * календарь, питание, привычки, advice по позициям.
 * Это ключевая фича, которая продаёт идею инвестору: Колобок
 * связывает деньги и жизнь в один план на день.
 */

import type {
  TinkoffPortfolioData,
  PortfolioAnalysis,
  FuturesPosition,
} from "../portfolio/parser";

export interface DailyPlan {
  /** Дата плана */
  date: string;
  /** Заголовок дня */
  headline: string;
  /** Блоки календаря */
  calendar: CalendarBlock[];
  /** Рекомендация по еде */
  meal: MealRecommendation;
  /** Привычка дня */
  habit: HabitRecommendation;
  /** Совет по фьючерсу */
  futuresAdvice: FuturesAdvice | null;
  /** Настроение для умного дома */
  smartHomeMood: SmartHomeMood;
  /** Мотивационная фраза от Колобка */
  kolobokQuote: string;
}

export interface CalendarBlock {
  time: string;
  duration: number; // минуты
  title: string;
  type: "work" | "rest" | "meal" | "sport" | "finance" | "learning";
  icon: string;
  reason?: string;
}

export interface MealRecommendation {
  dish: string;
  ingredients: string[];
  benefit: string;
  recipeId?: string;
}

export interface HabitRecommendation {
  title: string;
  icon: string;
  reason: string;
  streakBoost: boolean;
}

export interface FuturesAdvice {
  ticker: string;
  action: "close" | "hold" | "reduce" | "hedge" | "set-stop";
  deadline: string;
  reason: string;
  urgency: "low" | "medium" | "high";
}

export interface SmartHomeMood {
  mode: "party" | "focus" | "cautious" | "calm";
  lighting: { color: string; brightness: number };
  sound: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/* ГЕНЕРАТОР ПЛАНА НА ДЕНЬ                                            */
/* ------------------------------------------------------------------ */

/**
 * Главная функция Orchestrator'а: превращает данные портфеля
 * в комплексный план на день.
 */
export function generateDailyPlan(
  portfolio: TinkoffPortfolioData,
  analysis: PortfolioAnalysis
): DailyPlan {
  const stress = analysis.stressScore;
  const isLosing = portfolio.pnl < 0;
  const isWinning = portfolio.pnl > 0;

  return {
    date: new Date().toISOString().split("T")[0],
    headline: buildHeadline(analysis, isWinning),
    calendar: buildCalendar(analysis, stress),
    meal: buildMeal(analysis, stress),
    habit: buildHabit(analysis, stress),
    futuresAdvice: buildFuturesAdvice(portfolio.futures, analysis),
    smartHomeMood: buildSmartHomeMood(analysis, isLosing, isWinning),
    kolobokQuote: buildKolobokQuote(analysis, isWinning),
  };
}

/* ---------- Заголовок дня ---------- */

function buildHeadline(a: PortfolioAnalysis, winning: boolean): string {
  if (a.riskLevel === "critical")
    return "🚨 День красной зоны — работаем по протоколу спокойствия";
  if (a.riskLevel === "high")
    return "⚠️ Портфель нервничает — и мы снижаем градус";
  if (winning) return "🎉 Портфель в плюсе — закрепляем успех без эйфории";
  return "☀️ Плановый день — занимаемся собой и делами";
}

/* ---------- Календарь ---------- */

function buildCalendar(a: PortfolioAnalysis, stress: number): CalendarBlock[] {
  const blocks: CalendarBlock[] = [
    {
      time: "07:00",
      duration: 30,
      title: "Зарядка + вода",
      type: "sport",
      icon: "🏃",
    },
    {
      time: "08:00",
      duration: 40,
      title: "Завтрак без телефона",
      type: "meal",
      icon: "🍳",
      reason: "Не смотри портфель на голодный желудок",
    },
  ];

  // При высоком стрессе добавляем блоки отдыха и убираем часть работы
  if (stress >= 40) {
    blocks.push(
      {
        time: "10:00",
        duration: 20,
        title: "Дыхательная пауза",
        type: "rest",
        icon: "🧘",
        reason: "Кортизол мешает принимать решения",
      },
      {
        time: "13:00",
        duration: 60,
        title: "Обед + прогулка",
        type: "rest",
        icon: "🌳",
        reason: "Смена обстановки снижает импульсивность сделок",
      },
      {
        time: "16:00",
        duration: 30,
        title: "Отдых, без экранов",
        type: "rest",
        icon: "🛋️",
        reason: "Точка пересмотра позиций",
      }
    );
  } else {
    blocks.push({
      time: "13:00",
      duration: 45,
      title: "Обед",
      type: "meal",
      icon: "🍲",
    });
  }

  blocks.push(
    {
      time: "18:00",
      duration: 30,
      title: "Финансовый обзор",
      type: "finance",
      icon: "📊",
      reason:
        stress >= 40
          ? "Только наблюдение — никаких решений"
          : "Единственное окно для сделок за день",
    },
    {
      time: "20:00",
      duration: 60,
      title:
        a.riskLevel === "critical"
          ? "Книга / сериал — диджитал-детокс"
          : "Новый навык (30 мин)",
      type: "learning",
      icon: a.riskLevel === "critical" ? "📖" : "🧠",
    }
  );

  return blocks;
}

/* ---------- Питание ---------- */

const MEALS_BY_STATE: Record<string, MealRecommendation> = {
  stress_high: {
    dish: "Паста с лососем",
    ingredients: ["лосось 150г", "паста 100г", "шпинат", "сливки 20%", "лимон"],
    benefit: "Омега-3 снижает кортизол, магний успокаивает нервы",
    recipeId: "pasta-salmon",
  },
  stress_medium: {
    dish: "Гречка с грибами и яйцом пашот",
    ingredients: ["гречка", "белые грибы", "яйца", "лук", "масло сливочное"],
    benefit: "Сложные углеводы дают ровную энергию без скачков сахара",
  },
  stress_low: {
    dish: "Сытный омлет с сыром и зеленью",
    ingredients: ["яйца 3шт", "сыр", "помидоры черри", "зелень", "сливки"],
    benefit: "Белок с утра = стабильная энергия до обеда",
  },
  winning: {
    dish: "Стейк из говядины с овощами гриль",
    ingredients: ["стейк рибай", "кабачок", "перец", "чеснок", "розмарин"],
    benefit: "Награда за дисциплину — но без шампанского до закрытия рынка!",
  },
  night: {
    dish: "Творог с бананом и мёдом",
    ingredients: ["творог 5%", "банан", "мёд", "корица"],
    benefit: "Казеин на ночь — сытно и легко для желудка",
  },
};

function buildMeal(a: PortfolioAnalysis, stress: number): MealRecommendation {
  const hour = new Date().getHours();

  if (hour >= 22 || hour < 5) return MEALS_BY_STATE.night;
  if (a.riskLevel === "critical" || stress >= 50)
    return MEALS_BY_STATE.stress_high;
  if (stress >= 25) return MEALS_BY_STATE.stress_medium;
  if (a.riskLevel === "low" && a.recommendations.some((r) => r.includes("🎉")))
    return MEALS_BY_STATE.winning;
  return MEALS_BY_STATE.stress_low;
}

/* ---------- Привычка дня ---------- */

function buildHabit(
  a: PortfolioAnalysis,
  stress: number
): HabitRecommendation {
  if (stress >= 50) {
    return {
      title: "10 минут медитации",
      icon: "🧘",
      reason: "Доказано: снижает импульсивные сделки на 30%",
      streakBoost: true,
    };
  }
  if (a.riskLevel === "high") {
    return {
      title: "Прогулка 30 минут без телефона",
      icon: "🌳",
      reason: "Физическая активность перерабатывает гормоны стресса",
      streakBoost: false,
    };
  }
  return {
    title: "Дневник решений: 3 пункта",
    icon: "📝",
    reason: "Записывай почему купил/продал — через месяц увидишь паттерны",
    streakBoost: true,
  };
}

/* ---------- Совет по фьючерсам ---------- */

function buildFuturesAdvice(
  futures: FuturesPosition[],
  a: PortfolioAnalysis
): FuturesAdvice | null {
  if (!futures.length) return null;

  // Ищем самую рискованную позицию
  const worst = [...futures].sort((x, y) => y.marginRisk - x.marginRisk)[0];
  const hour = new Date().getHours();

  if (worst.marginRisk > 75 && worst.currentPnl < 0) {
    return {
      ticker: worst.ticker,
      action: "close",
      deadline: "до 18:00",
      reason: `Маржинальная нагрузка ${worst.marginRisk}% — при продолжении падения брокер принудительно закроет позицию. Лучше закрыть самому.`,
      urgency: "high",
    };
  }

  if (worst.marginRisk > 60 && worst.currentPnl < 0) {
    return {
      ticker: worst.ticker,
      action: "reduce",
      deadline: "до конца дня",
      reason: `Рекомендую сократить позицию по ${worst.ticker} на 50% и выставить стоп-заявку${worst.stopLoss ? ` на уровне ${worst.stopLoss}` : ""}.`,
      urgency: "medium",
    };
  }

  if (worst.currentPnl > 0 && worst.marginRisk < 40) {
    return {
      ticker: worst.ticker,
      action: "set-stop",
      deadline: "прямо сейчас",
      reason: `По ${worst.ticker} прибыль — зафиксируй стоп в безубыток. Жадность — главный враг.`,
      urgency: "low",
    };
  }

  if (a.riskLevel === "critical" && hour < 18) {
    return {
      ticker: worst.ticker,
      action: "hold",
      deadline: "не трогать до 18:00",
      reason:
        "Худшее время для решений — утро после просадки. Подожди, рынок остынет.",
      urgency: "medium",
    };
  }

  return null;
}

/* ---------- Умный дом ---------- */

function buildSmartHomeMood(
  a: PortfolioAnalysis,
  isLosing: boolean,
  isWinning: boolean
): SmartHomeMood {
  if (isWinning && a.riskLevel === "low") {
    return {
      mode: "party",
      lighting: { color: "#ffd766", brightness: 90 },
      sound: "upbeat-playlist",
      description:
        "🎉 Тёплый золотой свет + твой плейлист. Колонки: «Колобок катится на успехе!»",
    };
  }
  if (isLosing || a.riskLevel === "critical" || a.riskLevel === "high") {
    return {
      mode: "focus",
      lighting: { color: "#4a6fa5", brightness: 40 },
      sound: "white-noise",
      description:
        "🌊 Приглушённый синий свет + белый шум. Никаких новостей, только работа и спокойствие.",
    };
  }
  return {
    mode: "calm",
    lighting: { color: "#e8d5b0", brightness: 65 },
    sound: "lo-fi",
    description: "☕ Нейтральный тёплый свет + lo-fi на фоне. Рабочий вайб.",
  };
}

/* ---------- Цитата Колобка ---------- */

function buildKolobokQuote(a: PortfolioAnalysis, winning: boolean): string {
  if (a.riskLevel === "critical")
    return "Ты отдыхай, а я для тебя заработаю. Но сегодня — отдыхай всерьёз. Рынок будет здесь и завтра, а нервы не вернёшь.";
  if (winning)
    return "Молодец, друже! Но помни: один удачный день — не успех. Успех — это когда ты закрываешь ноутбук вовремя.";
  return "Катится Колобок по дорожке — и твой портфель катится. Главное — направление, а не скорость.";
}

/* ------------------------------------------------------------------ */
/* СИМУЛЯЦИЯ УМНОГО ДОМА (mock)                                        */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    kolobokSmartHome?: {
      setMood: (mood: SmartHomeMood) => void;
      lastMood?: SmartHomeMood;
    };
  }
}

/**
 * Интеграция с умным домом (mock).
 * В продакшене здесь будут команды на MQTT/HA-REST API.
 */
export function setMood(mood: SmartHomeMood): void {
  if (typeof window === "undefined") return;
  if (!window.kolobokSmartHome) {
    window.kolobokSmartHome = {} as unknown as typeof window.kolobokSmartHome;
  }
  window.kolobokSmartHome!.lastMood = mood;
  // eslint-disable-next-line no-console
  console.log(
    `[SmartHome Mock] Режим: ${mood.mode} | Свет: ${mood.lighting.color} @${mood.lighting.brightness}% | Звук: ${mood.sound}`
  );
}
