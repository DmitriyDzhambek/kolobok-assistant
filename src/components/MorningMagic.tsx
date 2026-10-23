import { motion, AnimatePresence } from "framer-motion";
import { AddHabit } from "./AddHabit";
import { useHabits } from "../habits/useHabits";

const EXAMPLES: [string, string][] = [
	["Выпить стакан воды", "💧"],
	["Зарядка 10 минут", "🏃"],
	["Проверить Mini Apps", "💰"],
];

/** Экран «Магия утра»: привычки-созвездия, стрики-цепочки, мотивация Колобка. */
export function MorningMagic() {
	const h = useHabits();
	const allDone =
		h.habits.length > 0 && h.habits.every((x) => x.today === "done");
	const dateRu = h.today
		? new Date(h.today + "T00:00:00").toLocaleDateString("ru-RU", {
				day: "numeric",
				month: "long",
				weekday: "short",
			})
		: "";

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
							? "проверяю бэкенд…"
							: h.online
								? "бэкенд на связи"
								: "бэкенд не запущен"
					}
				/>
			</div>

			{h.online === false && (
				<div className="glass morning-offline">
					Привычки живут в Python-бэкенде: запусти на компьютере{" "}
					<code>backend\start_backend.bat</code> (или{" "}
					<code>python backend/macro_server.py</code>) — и кристаллы зажгутся.
				</div>
			)}
			{h.lastError && h.online !== false && (
				<div className="morning-err">{h.lastError}</div>
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
							}`}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={{ delay: i * 0.04 }}
						>
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
									onClick={() =>
										void h.mark(hb.id, hb.today === "done" ? "clear" : "done")
									}
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

			{h.habits.length === 0 && h.online !== false && (
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
