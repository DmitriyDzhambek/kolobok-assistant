/** «Магия утра» в режиме тишины: привычки живут в localStorage браузера.
 *
 * Если бэкенд недоступен, человек всё равно может добавлять привычки,
 * отмечать их, видеть прогресс и стрики. Формат данных повторяет серверный
 * (habits + logs), логика стриков — один в один с backend/db.py, поэтому
 * будущая синхронизация с сервером будет простой.
 */

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
	/** Последние 7 дней (6 дней назад … сегодня) — «цепочка звёзд». */
	week: boolean[];
};

type StoredHabit = {
	id: string;
	title: string;
	icon: string;
	created_at: string;
	sort_order: number;
	best_streak: number;
};

type StoredLog = {
	habit_id: string;
	day: string;
	status: "done" | "skipped";
	marked_at: string;
};

type Stored = { habits: StoredHabit[]; logs: StoredLog[] };

const KEY = "kolobok.habits.local.v1";
const MAX_HABITS = 30;

function load(): Stored {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { habits: [], logs: [] };
		const d = JSON.parse(raw) as Partial<Stored>;
		return {
			habits: Array.isArray(d.habits) ? d.habits : [],
			logs: Array.isArray(d.logs) ? d.logs : [],
		};
	} catch {
		return { habits: [], logs: [] };
	}
}

function save(d: Stored) {
	try {
		localStorage.setItem(KEY, JSON.stringify(d));
	} catch {
		/* приватный режим/переполнение — работаем в памяти этой сессии */
	}
}

export function todayStr(offsetDays = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function logmapFor(logs: StoredLog[], habitId: string): Map<string, string> {
	const m = new Map<string, string>();
	for (const l of logs) if (l.habit_id === habitId) m.set(l.day, l.status);
	return m;
}

/** current/best/week — та же логика, что в backend/db.py compute_streak. */
function computeStreak(lm: Map<string, string>) {
	const today = todayStr();
	const d = new Date();
	if (lm.get(today) !== "done") d.setDate(d.getDate() - 1);
	let current = 0;
	for (;;) {
		const p = (n: number) => String(n).padStart(2, "0");
		const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
		if (lm.get(key) !== "done") break;
		current += 1;
		d.setDate(d.getDate() - 1);
	}

	const doneDays = [...lm.entries()]
		.filter(([, st]) => st === "done")
		.map(([day]) => day)
		.sort();
	let best = 0;
	let run = 0;
	let prev: Date | null = null;
	for (const ds of doneDays) {
		const cur = new Date(ds + "T00:00:00");
		run =
			prev && (cur.getTime() - prev.getTime()) / 86400000 === 1 ? run + 1 : 1;
		best = Math.max(best, run);
		prev = cur;
	}

	const week: boolean[] = [];
	for (let i = 6; i >= 0; i--) {
		week.push(lm.get(todayStr(-i)) === "done");
	}
	return { current, best: Math.max(best, current), week };
}

export function localHabitsView(): { habits: Habit[]; today: string } {
	const d = load();
	const habits = d.habits
		.slice()
		.sort(
			(a, b) =>
				a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
		)
		.map((h) => {
			const lm = logmapFor(d.logs, h.id);
			const st = computeStreak(lm);
			return {
				...h,
				today: (lm.get(todayStr()) as Habit["today"]) ?? null,
				streak: st.current,
				best_streak: Math.max(h.best_streak || 0, st.best),
				week: st.week,
			};
		});
	return { habits, today: todayStr() };
}

export function localAdd(title: string, icon: string): string | null {
	const t = title.trim();
	if (!t) return "Название привычки не может быть пустым.";
	const d = load();
	if (d.habits.length >= MAX_HABITS)
		return `Максимум ${MAX_HABITS} привычек — сначала удалите лишние.`;
	d.habits.push({
		id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
		title: t.slice(0, 80),
		icon: icon.trim() || "⭐",
		created_at: new Date().toISOString(),
		sort_order: d.habits.length,
		best_streak: 0,
	});
	save(d);
	return null;
}

export function localMark(
	id: string,
	status: "done" | "skipped" | "clear",
	day?: string,
): void {
	const d = load();
	const key = day || todayStr();
	d.logs = d.logs.filter((l) => !(l.habit_id === id && l.day === key));
	if (status === "done" || status === "skipped")
		d.logs.push({
			habit_id: id,
			day: key,
			status,
			marked_at: new Date().toISOString(),
		});
	// обновляем рекорд привычки
	for (const h of d.habits) {
		if (h.id !== id) continue;
		const st = computeStreak(logmapFor(d.logs, id));
		if (st.best > (h.best_streak || 0)) h.best_streak = st.best;
	}
	save(d);
}

export function localRemove(id: string): void {
	const d = load();
	d.habits = d.habits.filter((h) => h.id !== id);
	d.logs = d.logs.filter((l) => l.habit_id !== id);
	save(d);
}

const LOCAL_MOTIVATION = [
	"Все кристаллы зажжены — утро удалось! Ты отдыхай, а я для тебя заработаю: сегодня твой день на шаг ближе к доходу мечты.",
	"Созвездие привычек собрано целиком! Именно такие утра складываются в большие деньги — продолжай цепочку, не разрывай.",
	"Утренняя магия выполнена на 100%. Маленькие ритуалы каждый день — это и есть инвестиция с самой высокой ставкой.",
];

export function localMotivation(doneTitles: string[]): string {
	const base = doneTitles.length
		? `Утро засияло: ${doneTitles.slice(0, 4).join(", ")} — готово! `
		: "";
	return base + LOCAL_MOTIVATION[doneTitles.length % LOCAL_MOTIVATION.length];
}
