export type CryptoCurrency = "USDT" | "TON" | "Gram";

export type DreamGoal = {
  id: string;
  title: string;
  currency: CryptoCurrency;
  targetAmount: number;
  createdAt: string;
};

export type DreamState = {
  goals: DreamGoal[];
  balances: Record<CryptoCurrency, number>;
};

const STORAGE_KEY = "kolobok.dream-jar.v1";

export const EMPTY_DREAM_STATE: DreamState = {
  goals: [],
  balances: { USDT: 0, TON: 0, Gram: 0 },
};

export function loadDreamState(): DreamState {
  if (typeof window === "undefined") {
    return { goals: [], balances: { USDT: 0, TON: 0, Gram: 0 } };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { goals: [], balances: { USDT: 0, TON: 0, Gram: 0 } };

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Сохранение сундука желаний повреждено.");
  }
  const candidate = parsed as Partial<DreamState>;
  const balances = candidate.balances ?? { USDT: 0, TON: 0, Gram: 0 };
  return {
    goals: Array.isArray(candidate.goals)
      ? candidate.goals.filter(
          (goal): goal is DreamGoal =>
            !!goal &&
            typeof goal.id === "string" &&
            typeof goal.title === "string" &&
            ["USDT", "TON", "Gram"].includes(goal.currency) &&
            Number.isFinite(goal.targetAmount) &&
            goal.targetAmount > 0,
        )
      : [],
    balances: {
      USDT: Number.isFinite(balances?.USDT) ? Math.max(0, balances.USDT) : 0,
      TON: Number.isFinite(balances?.TON) ? Math.max(0, balances.TON) : 0,
      Gram: Number.isFinite(balances?.Gram) ? Math.max(0, balances.Gram) : 0,
    },
  };
}

export function saveDreamState(state: DreamState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function recordCryptoEarning(
  amount: number,
  currency: CryptoCurrency,
): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Сумма накопления должна быть больше нуля.");
  }
  const state = loadDreamState();
  state.balances[currency] += amount;
  saveDreamState(state);
}
