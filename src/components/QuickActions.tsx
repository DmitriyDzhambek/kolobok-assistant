import { motion } from "framer-motion";
import { RECIPES } from "../recipes/data";

export type QuickAction = {
	id: string;
	emoji: string;
	title: string;
	desc: string;
	onClick: () => void;
};

/** «Рецепт дня» — детерминированно выбирается по дню года из книги рецептов. */
export function recipeOfTheDay(): { id: string; title: string } {
	const now = new Date();
	const start = new Date(now.getFullYear(), 0, 0).getTime();
	const doy = Math.floor((now.getTime() - start) / 86400000);
	const r = RECIPES[doy % RECIPES.length];
	return { id: r.id, title: r.title };
}

/** Быстрые действия: вместо узкой полосы — сетка крупных стеклянных карточек
 * (минимум 104px высотой), матовое стекло, золотая обводка при наведении,
 * плавное нажатие scale-down и появление fade-in/slide-up через framer-motion. */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
	return (
		<section className="quick" aria-label="Быстрые действия">
			<div className="quick-title">⚡ Быстрые действия</div>
			<div className="quick-grid">
				{actions.map((a, i) => (
					<motion.button
						key={a.id}
						type="button"
						className="quick-card"
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.04 + i * 0.05, duration: 0.24 }}
						whileHover={{ y: -3 }}
						whileTap={{ scale: 0.95 }}
						onClick={a.onClick}
					>
						<span className="qc-ico" aria-hidden>
							{a.emoji}
						</span>
						<span className="qc-body">
							<span className="qc-title">{a.title}</span>
							<span className="qc-desc">{a.desc}</span>
						</span>
						<span className="qc-go" aria-hidden>
							→
						</span>
					</motion.button>
				))}
			</div>
		</section>
	);
}
