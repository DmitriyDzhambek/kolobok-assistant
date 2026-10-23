import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";

const ICONS = ["⭐", "💧", "🏃", "📚", "🧘", "💰", "🦷", "🌅"];

/** Форма добавления новой привычки («Магия утра»).
 * onAdd возвращает null при успехе или текст ошибки. */
export function AddHabit({
	onAdd,
}: {
	onAdd: (title: string, icon: string) => Promise<string | null>;
}) {
	const [title, setTitle] = useState("");
	const [icon, setIcon] = useState("⭐");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		const t = title.trim();
		if (!t) {
			setErr("Введи название ритуала — например «Выпить стакан воды».");
			return;
		}
		setBusy(true);
		setErr(null);
		const m = await onAdd(t, icon);
		setBusy(false);
		if (m) setErr(m);
		else {
			setTitle("");
			setIcon("⭐");
		}
	};

	return (
		<motion.form
			className="habit-add glass"
			onSubmit={submit}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
		>
			<div className="habit-icons">
				{ICONS.map((ic) => (
					<motion.button
						type="button"
						key={ic}
						whileTap={{ scale: 0.85 }}
						className={`habit-icon ${icon === ic ? "on" : ""}`}
						onClick={() => setIcon(ic)}
						title={`Кристалл: ${ic}`}
					>
						{ic}
					</motion.button>
				))}
			</div>
			<div className="habit-addrow">
				<input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					maxLength={80}
					placeholder="Новый утренний ритуал… (например: Проверить Mini Apps)"
				/>
				<motion.button
					type="submit"
					className="macro-btn"
					whileHover={{ scale: 1.03 }}
					whileTap={{ scale: 0.95 }}
					disabled={busy}
				>
					{busy ? "Добавляю…" : "+ Добавить"}
				</motion.button>
			</div>
			{err && <div className="morning-err">{err}</div>}
		</motion.form>
	);
}
