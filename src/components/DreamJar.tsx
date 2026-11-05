import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Coins, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  EMPTY_DREAM_STATE,
  loadDreamState,
  saveDreamState,
  type CryptoCurrency,
  type DreamGoal,
  type DreamState,
} from "../dreams/storage";
import { useCryptoRates, type CryptoRates } from "../hooks/useCryptoRates";

type GoalForm = {
  title: string;
  currency: CryptoCurrency;
  targetAmount: string;
};

const EMPTY_FORM: GoalForm = { title: "", currency: "USDT", targetAmount: "" };
const GRAM_DEMO_RATE_RUB = 5;

function convertToRub(
  amount: number,
  currency: CryptoCurrency,
  rates: CryptoRates,
): number {
  const rate =
    currency === "USDT"
      ? rates.usdtToRub
      : currency === "TON"
        ? rates.tonToRub
        : GRAM_DEMO_RATE_RUB;
  return Number.isFinite(amount) && rate ? amount * rate : 0;
}

function formatCrypto(value: number, currency: CryptoCurrency): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: currency === "Gram" ? 0 : 4,
  }).format(value);
}

function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

type DreamJarProps = {
  revision?: number;
};

export function DreamJar({ revision = 0 }: DreamJarProps) {
  const rates = useCryptoRates();
  const [dreamState, setDreamState] = useState<DreamState>(EMPTY_DREAM_STATE);
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setDreamState(loadDreamState());
      setError("");
    } catch (loadError) {
      console.error("Не удалось загрузить сундук желаний:", loadError);
      setError("Не удалось прочитать сохранённые цели. Данные не изменены.");
    }
  }, [revision]);

  const amount = Number(form.targetAmount);
  const estimatedRub = convertToRub(amount, form.currency, rates);

  const persist = (nextState: DreamState) => {
    try {
      saveDreamState(nextState);
      setDreamState(nextState);
      setError("");
      return true;
    } catch (saveError) {
      console.error("Не удалось сохранить сундук желаний:", saveError);
      setError("Не удалось сохранить изменения. Проверь свободное место в браузере.");
      return false;
    }
  };

  const submitGoal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title || !Number.isFinite(amount) || amount <= 0) {
      setError("Укажи название мечты и цель больше нуля.");
      return;
    }

    const goals = editingGoalId
      ? dreamState.goals.map((goal) =>
          goal.id === editingGoalId
            ? { ...goal, title, currency: form.currency, targetAmount: amount }
            : goal,
        )
      : [
          ...dreamState.goals,
          {
            id: `dream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            currency: form.currency,
            targetAmount: amount,
            createdAt: new Date().toISOString(),
          },
        ];

    if (persist({ ...dreamState, goals })) {
      setForm(EMPTY_FORM);
      setEditingGoalId(null);
    }
  };

  const startEditing = (goal: DreamGoal) => {
    setEditingGoalId(goal.id);
    setForm({
      title: goal.title,
      currency: goal.currency,
      targetAmount: String(goal.targetAmount),
    });
    setError("");
  };

  const removeGoal = (goalId: string) => {
    if (!persist({
      ...dreamState,
      goals: dreamState.goals.filter((goal) => goal.id !== goalId),
    })) {
      return;
    }
    if (editingGoalId === goalId) {
      setEditingGoalId(null);
      setForm(EMPTY_FORM);
    }
  };

  const cancelEditing = () => {
    setEditingGoalId(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  return (
    <section className="dream-screen" aria-labelledby="dream-title">
      <header className="dream-heading">
        <span className="dream-eyebrow">МЕЧТЫ В ЦИФРОВЫХ АКТИВАХ</span>
        <h2 id="dream-title">Сундук желаний</h2>
        <p>Поставь цель, отмечай заработок и следи за прогрессом.</p>
      </header>

      <div className="dream-wallet" aria-label="Баланс накоплений">
        {(["USDT", "TON", "Gram"] as const).map((currency) => (
          <div className="dream-wallet-item" key={currency}>
            <span>{currency}</span>
            <strong>{formatCrypto(dreamState.balances[currency], currency)}</strong>
          </div>
        ))}
      </div>

      <motion.form
        className="dream-form"
        onSubmit={submitGoal}
        layout
      >
        <div className="dream-form-heading">
          <span className="dream-form-icon"><Coins size={20} /></span>
          <h3>{editingGoalId ? "Редактировать желание" : "Добавить желание"}</h3>
        </div>
        <label className="dream-field">
          <span>На что копим?</span>
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            maxLength={70}
            placeholder="Например, наушники"
            required
          />
        </label>
        <div className="dream-form-row">
          <label className="dream-field">
            <span>Валюта цели</span>
            <select
              value={form.currency}
              onChange={(event) => {
                const value = event.target.value;
                const currency: CryptoCurrency =
                  value === "TON" || value === "Gram" ? value : "USDT";
                setForm({ ...form, currency });
              }}
            >
              <option value="USDT">USDT</option>
              <option value="TON">TON</option>
              <option value="Gram">Gram</option>
            </select>
          </label>
          <label className="dream-field">
            <span>Целевая сумма</span>
            <input
              type="number"
              min="0.0001"
              step="any"
              inputMode="decimal"
              value={form.targetAmount}
              onChange={(event) =>
                setForm({ ...form, targetAmount: event.target.value })
              }
              placeholder="50"
              required
            />
          </label>
        </div>
        <AnimatePresence mode="wait">
          {amount > 0 && Number.isFinite(amount) && rates.isLoading ? (
            <motion.div
              key="loading"
              className="dream-conversion dream-conversion-loading"
              role="status"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              Считаю курс…
            </motion.div>
          ) : amount > 0 && Number.isFinite(amount) ? (
            <motion.div
              key={`${form.currency}-${estimatedRub}-${rates.lastUpdated}`}
              className="dream-conversion"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              ~ {formatRub(estimatedRub)} ₽ по курсу на сегодня
            </motion.div>
          ) : null}
        </AnimatePresence>
        <p
          className={`dream-rate-note${rates.isFallback ? " is-fallback" : ""}`}
          role={rates.error ? "status" : undefined}
        >
          {rates.isFallback
            ? `Резервный курс${rates.error ? ": данные CoinGecko временно недоступны." : " до получения актуальных данных."} TON — 500 ₽, USDT — 90 ₽. Gram — демо-оценка 5 ₽.`
            : `Источник: CoinGecko · обновление каждые 5 минут. Gram — демо-оценка 5 ₽.`}
        </p>
        {error && <p className="dream-error" role="alert">{error}</p>}
        <div className="dream-form-actions">
          <button type="submit" className="dream-save-button">
            {editingGoalId ? <Check size={17} /> : <Plus size={17} />}
            {editingGoalId ? "Сохранить" : "Создать цель"}
          </button>
          {editingGoalId && (
            <button type="button" className="dream-cancel-button" onClick={cancelEditing}>
              <X size={17} />
              Отмена
            </button>
          )}
        </div>
      </motion.form>

      <div className="dream-goals" aria-live="polite">
        {dreamState.goals.length === 0 ? (
          <div className="dream-empty">
            <span aria-hidden="true">✨</span>
            <p>Создай первую цель — и Колобок поможет следить за накоплениями.</p>
          </div>
        ) : (
          dreamState.goals.map((goal) => {
            const balance = dreamState.balances[goal.currency];
            const progress = Math.min(100, (balance / goal.targetAmount) * 100);
            return (
              <motion.article
                className="dream-goal-card"
                key={goal.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="dream-goal-top">
                  <div>
                    <span className="dream-goal-label">МОЯ МЕЧТА</span>
                    <h3>{goal.title}</h3>
                  </div>
                  <div className="dream-goal-actions">
                    <button
                      type="button"
                      onClick={() => startEditing(goal)}
                      aria-label={`Редактировать цель ${goal.title}`}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoal(goal.id)}
                      aria-label={`Удалить цель ${goal.title}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <div className="dream-progress-label">
                  <strong>
                    {formatCrypto(balance, goal.currency)} /{" "}
                    {formatCrypto(goal.targetAmount, goal.currency)} {goal.currency}
                  </strong>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div
                  className="dream-progress-track"
                  role="progressbar"
                  aria-label={`Прогресс накопления на ${goal.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                >
                  <motion.span
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <p className="dream-progress-note">
                  Общий баланс {goal.currency}; пополнение фиксируется в Авто-Пилоте.
                </p>
              </motion.article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default DreamJar;
