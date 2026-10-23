import { useCallback, useEffect, useState } from "react";
import { apiFetch, friendlyApiError } from "../api/client";

export type Habit = {
	id: string;
	title: string;
	icon: string;
	created_at?: string;
	sort_order?: number;
	archived?: boolean;
	/** Отметка сегодняшнего дня: выполнено / пропущено / нет отметки. */
	today: "done" | "skipped" | null;
	/** Текущая цепочка дней подряд. */
	streak: number;
	/** Рекорд цепочки. */
	best_streak: number;
	/** Последние 7 дней (6 дней назад … сегодня) — для «цепочки звёзд». */
	week: boolean[];
};

export function useHabits() {
	const [habits, setHabits] = useState<Habit[]>([]);
	const [today, setToday] = useState("");
	/** null — ещё не проверяли; true — бэкенд на связи; false — не запущен. */
	const [online, setOnline] = useState<boolean | null>(null);
	const [lastError, setLastError] = useState<string | null>(null);
	const [motivation, setMotivation] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const d = await apiFetch("/api/habits", undefined, 5000);
			setHabits(Array.isArray(d?.habits) ? d.habits : []);
			setToday(String(d?.today ?? ""));
			setOnline(true);
			setLastError(null);
		} catch (e) {
			setOnline(false);
			setLastError(friendlyApiError(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const add = async (title: string, icon: string): Promise<string | null> => {
		try {
			await apiFetch("/api/habits", {
				method: "POST",
				body: JSON.stringify({ title, icon }),
			});
			setLastError(null);
			await load();
			return null;
		} catch (e) {
			const m = friendlyApiError(e);
			setLastError(m);
			return m;
		}
	};

	const mark = async (
		id: string,
		status: "done" | "skipped" | "clear",
	): Promise<string | null> => {
		try {
			const r = await apiFetch(`/api/habits/${id}/log`, {
				method: "POST",
				body: JSON.stringify({ status }),
			});
			if (r?.motivation?.reply) setMotivation(String(r.motivation.reply));
			setLastError(null);
			await load();
			return null;
		} catch (e) {
			const m = friendlyApiError(e);
			setLastError(m);
			return m;
		}
	};

	const remove = async (id: string): Promise<string | null> => {
		try {
			await apiFetch(`/api/habits/${id}`, { method: "DELETE" });
			setLastError(null);
			await load();
			return null;
		} catch (e) {
			const m = friendlyApiError(e);
			setLastError(m);
			return m;
		}
	};

	const askMotivation = async (): Promise<void> => {
		try {
			const r = await apiFetch("/api/morning/motivation", { method: "POST" });
			if (r?.reply) setMotivation(String(r.reply));
			setLastError(null);
		} catch (e) {
			setLastError(friendlyApiError(e));
		}
	};

	return {
		habits,
		today,
		online,
		lastError,
		motivation,
		add,
		mark,
		remove,
		askMotivation,
		reload: load,
	};
}

export type HabitsApi = ReturnType<typeof useHabits>;
