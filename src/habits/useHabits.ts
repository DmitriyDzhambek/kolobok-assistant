import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, isNetworkError } from "../api/client";
import { useConnection } from "../net/connection";
import {
	localAdd,
	localHabitsView,
	localMark,
	localMotivation,
	localRemove,
	type Habit,
} from "./localStore";

export type { Habit };

export type HabitsMode = "server" | "local";

/** «Магия утра»: привычки с сервера, а при потере связи — из localStorage.
 * Пользователь никогда не видит технических ошибок: сеть пропадает —
 * включается «режим тишины» (mode="local"), связь вернулась — снова сервер. */
export function useHabits() {
	const conn = useConnection();
	/** null — ещё подключаемся; true — на связи; false — режим тишины. */
	const online = conn === "online" ? true : conn === "offline" ? false : null;

	const [serverHabits, setServerHabits] = useState<Habit[] | null>(null);
	const [serverToday, setServerToday] = useState("");
	const [lastError, setLastError] = useState<string | null>(null);
	const [motivation, setMotivation] = useState<string | null>(null);
	const [localTick, setLocalTick] = useState(0);

	const load = useCallback(async () => {
		try {
			const d = await apiFetch("/api/habits", undefined, 5000);
			setServerHabits(Array.isArray(d?.habits) ? d.habits : []);
			setServerToday(String(d?.today ?? ""));
			setLastError(null);
		} catch (e) {
			// Сеть пропала — молча переключаемся на локальные кристаллы.
			if (!isNetworkError(e)) setLastError(String((e as Error)?.message ?? e));
		}
	}, []);

	useEffect(() => {
		if (conn === "online") void load();
	}, [conn, load]);

	const local = useMemo(
		() => (online === true ? null : localHabitsView()),
		// localTick пересчитывает локальное представление после изменений
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[online, localTick],
	);
	const bumpLocal = () => setLocalTick((t) => t + 1);

	const mode: HabitsMode =
		online === true && serverHabits !== null ? "server" : "local";
	const habits =
		mode === "server" ? (serverHabits ?? []) : (local?.habits ?? []);
	const today = mode === "server" ? serverToday : (local?.today ?? "");

	const allDoneNow = (): boolean => {
		const list = mode === "server" ? habits : localHabitsView().habits;
		return list.length > 0 && list.every((x) => x.today === "done");
	};
	const doneTitles = (): string[] =>
		(mode === "server" ? habits : localHabitsView().habits)
			.filter((x) => x.today === "done")
			.map((x) => x.title);

	const add = async (title: string, icon: string): Promise<string | null> => {
		if (mode === "local") {
			const err = localAdd(title, icon);
			bumpLocal();
			if (!err && allDoneNow()) setMotivation(localMotivation(doneTitles()));
			return err;
		}
		try {
			await apiFetch("/api/habits", {
				method: "POST",
				body: JSON.stringify({ title, icon }),
			});
			setLastError(null);
			await load();
			return null;
		} catch (e) {
			if (isNetworkError(e)) {
				// связь пропала прямо во время запроса — сохраняем локально
				const err = localAdd(title, icon);
				bumpLocal();
				return err;
			}
			const m = String((e as Error)?.message ?? e);
			setLastError(m);
			return m;
		}
	};

	const mark = async (
		id: string,
		status: "done" | "skipped" | "clear",
	): Promise<string | null> => {
		if (mode === "local") {
			localMark(id, status);
			bumpLocal();
			if (status === "done" && allDoneNow())
				setMotivation(localMotivation(doneTitles()));
			return null;
		}
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
			if (isNetworkError(e)) {
				localMark(id, status);
				bumpLocal();
				if (status === "done" && allDoneNow())
					setMotivation(localMotivation(doneTitles()));
				return null;
			}
			const m = String((e as Error)?.message ?? e);
			setLastError(m);
			return m;
		}
	};

	const remove = async (id: string): Promise<string | null> => {
		if (mode === "local") {
			localRemove(id);
			bumpLocal();
			return null;
		}
		try {
			await apiFetch(`/api/habits/${id}`, { method: "DELETE" });
			setLastError(null);
			await load();
			return null;
		} catch (e) {
			if (isNetworkError(e)) {
				localRemove(id);
				bumpLocal();
				return null;
			}
			const m = String((e as Error)?.message ?? e);
			setLastError(m);
			return m;
		}
	};

	const askMotivation = async (): Promise<void> => {
		if (mode === "local") {
			setMotivation(localMotivation(doneTitles()));
			return;
		}
		try {
			const r = await apiFetch("/api/morning/motivation", { method: "POST" });
			if (r?.reply) setMotivation(String(r.reply));
			setLastError(null);
		} catch (e) {
			if (isNetworkError(e)) setMotivation(localMotivation(doneTitles()));
			else setLastError(String((e as Error)?.message ?? e));
		}
	};

	return {
		habits,
		today,
		online,
		mode,
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
