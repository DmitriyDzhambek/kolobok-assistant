import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AddHabit } from "./AddHabit";
import { useHabits } from "../habits/useHabits";

const EXAMPLES: [string, string][] = [
	["Выпить стакан воды", "💧"],
	["Зарядка 10 минут", "🏃"],
	["Проверить Mini Apps", "💰"],
];

/** Экран «Магия утра»: привычки-кристаллы, прогресс-бар утра, стрики-цепочки,
 * анимация выполнения и мотивация Колобка. Работает и с бэкендом, и локально
 * (режим тишины — localStorage), без технических сообщений пользователю. */
export function MorningMagic() {
	const h = useHabits();
	const [flash, setFlash] = useState<{ id: string; key: number } | null>(null);

	useEffect(() => {
		if (!flash) return;
		const t = setTimeout(() => setFlash(null), 1600);
		return () => clearTimeout(t);
	}, [flash]);

	const total = h.habits.length;
	const doneCount = h.habits.filter((x) => x.today === "done").length;
	const pct = total ? Math.round((doneCount / total) * 100) : 0;
	const allDone = total > 0 && doneCount === total;
	const dateRu = h.today
		? new Date(h.today + "T00:00:00").toLocaleDateString("ru-RU", {
				day: "numeric",
				month: "long",
				weekday: "short",
			})
		: "";

	const markDone = (id: string, currentlyDone: boolean) => {
		if (!currentlyDone) setFlash({ id, key: Date.now() });
		void h.mark(id, currentlyDone ? "clear" : "done");
	};

	return (
		<div className="morning">
			<div className="morning-head glass">
				<b>✨ Магия утра</b>
				{dateRu && <span className="morning-date">{dateRu}</span>}
				<span
					className={`macro-dot ${
						h.online === null ? "" : h.online ? "st-playing" : "st-offline"
					}`}
					title={
						h.online === null
							? "просыпаюсь…"
							: h.online
								? "на связи"
								: "режим тишины"
					}
				/>
			</div>

			{h.online === false && (
				<motion.div
					className="glass morning-quiet"
					initial={{ opacity: 0, y: -6 }}
					animate={{ opacity: 1, y: 0 }}
				>
					🌙 <b>Режим тишины.</b> Колобок временно без связи с волшебным лесом —
					но кристаллы живут прямо в твоём браузере: отмечай привычки, прогресс
					и стрики сохранятся. Как только связь вернётся, всё продолжится само.
				</motion.div>
			)}
			{h.lastError && h.online !== false && (
				<div className="morning-err">{h.lastError}</div>
			)}

			{total > 0 && (
				<div className="glass morning-progress" aria-label="Прогресс утра">
					<div className="mp-row">
						<b>Прогресс утра</b>
						<span>
							{doneCount}/{total} кристаллов · {pct}%
						</span>
					</div>
					<div className="mp-track">
						<motion.div
							className="mp-fill"
							initial={{ width: 0 }}
							animate={{ width: `${pct}%` }}
							transition={{ type: "spring", stiffness: 120, damping: 20 }}
						/>
					</div>
				</div>
			)}

			<AnimatePresence>
				{allDone && (
					<motion.div
						className="glass motivation"
						initial={{ opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0 }}
					>
						<span className="mot-ico">🌟</span>
						{h.motivation ? (
							<span>{h.motivation}</span>
						) : (
							<button
								className="mot-btn"
								onClick={() => void h.askMotivation()}
							>
								Утро сияет! Попросить мотивацию у Колобка
							</button>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			<div className="habits-grid">
				<AnimatePresence>
					{h.habits.map((hb, i) => (
						<motion.div
							layout
							key={hb.id}
							className={`habit ${
								hb.today === "done"
									? "done"
									: hb.today === "skipped"
										? "skipped"
										: ""
							} ${flash?.id === hb.id ? "flash-on" : ""}`}
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={{ delay: i * 0.05 }}
						>
							<AnimatePresence>
								{flash?.id === hb.id && (
									<motion.div
										key={flash.key}
										className="habit-flash"
										initial={{ opacity: 0, y: 8, scale: 0.8 }}
										animate={{ opacity: 1, y: -4, scale: 1 }}
										exit={{ opacity: 0, y: -20 }}
										transition={{ duration: 0.35 }}
									>
										Выполнено! +1 к продуктивности
									</motion.div>
								)}
							</AnimatePresence>
							<button
								className="habit-x"
								title="Удалить привычку"
								onClick={() => void h.remove(hb.id)}
							>
								×
							</button>
							<div className="habit-crystal">
								<span>{hb.icon || "⭐"}</span>
							</div>
							<div className="habit-title">{hb.title}</div>
							<div className="habit-streak">
								🔥 {hb.streak} <small>рекорд {hb.best_streak}</small>
							</div>
							<div className="habit-week" title="Цепочка за 7 дней">
								{hb.week.map((d, k) => (
									<span key={k} className={d ? "star on" : "star"}>
										★
									</span>
								))}
							</div>
							<div className="habit-acts">
								<motion.button
									whileTap={{ scale: 0.88 }}
									className={hb.today === "done" ? "on" : ""}
									title={hb.today === "done" ? "Снять отметку" : "Выполнено!"}
									onClick={() => markDone(hb.id, hb.today === "done")}
								>
									✓
								</motion.button>
								<motion.button
									whileTap={{ scale: 0.88 }}
									className={hb.today === "skipped" ? "on" : ""}
									title={
										hb.today === "skipped"
											? "Снять отметку"
											: "Пропустить сегодня"
									}
									onClick={() =>
										void h.mark(
											hb.id,
											hb.today === "skipped" ? "clear" : "skipped",
										)
									}
								>
									⏭
								</motion.button>
							</div>
						</motion.div>
					))}
				</AnimatePresence>
			</div>

			{h.habits.length === 0 && (
				<div className="glass morning-empty">
					Созвездие пока пустое. Добавь первый утренний ритуал — например:
					<div className="morning-examples">
						{EXAMPLES.map(([t, ic]) => (
							<motion.button
								key={t}
								whileTap={{ scale: 0.94 }}
								onClick={() => void h.add(t, ic)}
							>
								{ic} {t}
							</motion.button>
						))}
					</div>
				</div>
			)}

			<AddHabit onAdd={h.add} />
		</div>
	);
}
