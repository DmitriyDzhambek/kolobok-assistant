import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	CATEGORIES,
	RECIPES,
	findCategory,
	searchRecipes,
	type CategoryId,
} from "../recipes/data";

const FAV_KEY = "kolobok-recipe-favs";

function loadFavs(): string[] {
	try {
		const raw = localStorage.getItem(FAV_KEY);
		const v = raw ? (JSON.parse(raw) as string[]) : [];
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}

/** «Волшебная книга рецептов»: карточка блюда как на референсе —
 * тёмно-синее стекло с золотом, мета-строка, ингредиенты в две колонки,
 * нумерованные шаги, кнопка «Сохранить рецепт» и лента категорий. */
export function RecipePanel({
	initialId,
	initialQuery,
	onClose,
}: {
	initialId?: string;
	initialQuery?: string;
	onClose: () => void;
}) {
	const [query, setQuery] = useState(initialQuery ?? "");
	const [cat, setCat] = useState<CategoryId | "all">(() => {
		if (initialQuery) {
			const c = findCategory(initialQuery);
			if (c) return c;
		}
		return "all";
	});
	const [selected, setSelected] = useState<string | null>(initialId ?? null);
	const [favs, setFavs] = useState<string[]>(loadFavs);
	const [backView, setBackView] = useState(false);

	const toggleFav = (id: string) => {
		setFavs((prev) => {
			const next = prev.includes(id)
				? prev.filter((x) => x !== id)
				: [...prev, id];
			try {
				localStorage.setItem(FAV_KEY, JSON.stringify(next));
			} catch {
				/* noop */
			}
			return next;
		});
	};

	const searched = useMemo(() => searchRecipes(query), [query]);
	const filtered = useMemo(
		() =>
			cat === "all" ? searched : searched.filter((r) => r.category === cat),
		[searched, cat],
	);
	const empty = filtered.length === 0;
	const grid = empty
		? cat === "all"
			? searchRecipes("")
			: searchRecipes("").filter((r) => r.category === cat)
		: filtered;

	const rec = selected
		? (RECIPES.find((r) => r.id === selected) ?? null)
		: null;
	const isFav = rec ? favs.includes(rec.id) : false;

	/* Анимация «Колобка» при нажатии «Назад» */
	const [kolobokRoll, setKolobokRoll] = useState(false);
	const handleBack = () => {
		setKolobokRoll(true);
		setTimeout(() => {
			setSelected(null);
			setKolobokRoll(false);
		}, 600);
	};

	return (
		<motion.aside
			className="recipe-panel"
			initial={{ opacity: 0, y: 16, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: 10, scale: 0.98 }}
			transition={{ duration: 0.2 }}
			aria-label="Волшебная книга рецептов"
		>
			<header className="rp-head">
				<div>
					<div className="rp-title">🍲 Волшебная книга рецептов</div>
					<div className="rp-sub">
						самые популярные блюда России — карточки прямо у Колобка, без
						браузера
					</div>
				</div>
				<button className="rp-close" onClick={onClose} title="Закрыть книгу">
					×
				</button>
			</header>

			<AnimatePresence mode="wait" initial={false}>
				{rec ? (
					<motion.div
						key={"card-" + rec.id}
						className="rp-card"
						initial={{ opacity: 0, x: 26 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -18 }}
						transition={{ duration: 0.18 }}
					>
						<div className="rp-card-head">
							<div className="rp-ico">{rec.emoji}</div>
							<div className="rp-names">
								<div className="rp-name">{rec.title}</div>
								<div className="rp-subname">{rec.subtitle}</div>
							</div>
							<div className="rp-badge">
								ВКУСНО
								<br />
								БЫСТРО
								<br />
								ПРОСТО!
							</div>
						</div>

						<div className="rp-meta">
							<div className="rp-meta-i">
								<span className="rp-mi">⏱</span>
								<div>
									<small>Время приготовления</small>
									<b>{rec.time}</b>
								</div>
							</div>
							<div className="rp-meta-i">
								<span className="rp-mi">🍽</span>
								<div>
									<small>Порций</small>
									<b>{rec.servings}</b>
								</div>
							</div>
							<div className="rp-meta-i">
								<span className="rp-mi">👨‍🍳</span>
								<div>
									<small>Сложность</small>
									<b>{rec.difficulty}</b>
								</div>
							</div>
						</div>

						<div className="rp-sec">🧺 Ингредиенты:</div>
						<ul className="rp-ing">
							{rec.ingredients.map((i) => (
								<li key={i}>{i}</li>
							))}
						</ul>

						<div className="rp-sec">👨‍🍳 Пошаговый рецепт:</div>
						<ol className="rp-steps">
							{rec.steps.map((s, i) => (
								<li key={i}>
									<span className="rp-num">{i + 1}</span>
									<span>{s}</span>
								</li>
							))}
						</ol>

						{rec.tip && <div className="rp-tip">💡 {rec.tip}</div>}

						<div className="rp-actions">
							<button className="rp-back" onClick={handleBack}>
								← К списку
							</button>
							<button
								className={`rp-save ${isFav ? "on" : ""}`}
								onClick={() => toggleFav(rec.id)}
							>
								{isFav ? "♥ Рецепт сохранён" : "👑 Сохранить рецепт ♥"}
							</button>
						</div>
					</motion.div>
				) : (
					<motion.div
						key="list"
						className="rp-list"
						initial={{ opacity: 0, x: -18 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 26 }}
						transition={{ duration: 0.18 }}
					>
						{/* Кнопка «Колобок катится назад» */}
						<button
							className="rp-back-btn"
							onClick={onClose}
							title="Колобок катится назад"
						>
							<span
								className={`rp-back-ball ${kolobokRoll ? "rp-ball-roll" : ""}`}
							>
								🟡
							</span>
							<span className="rp-back-text">Колобок катится назад</span>
						</button>

						<div className="rp-search">
							<span className="rp-search-ico">🔎</span>
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Найти рецепт борща, оливье, плова…"
								aria-label="Поиск рецепта"
							/>
						</div>

						<div className="rp-cats">
							<button
								className={`rp-cat ${cat === "all" ? "on" : ""}`}
								onClick={() => setCat("all")}
							>
								<span className="rp-cat-ico">⭐</span>Все
							</button>
							{CATEGORIES.map((c) => (
								<button
									key={c.id}
									className={`rp-cat ${cat === c.id ? "on" : ""}`}
									onClick={() => setCat(c.id)}
								>
									<span className="rp-cat-ico">{c.emoji}</span>
									{c.label}
								</button>
							))}
						</div>

						{empty && (
							<div className="rp-empty">
								По запросу «{query}» в этой полке пусто — держи самые популярные
								в России:
							</div>
						)}

						<div className="rp-grid">
							{grid.map((r) => (
								<motion.button
									key={r.id}
									className="rp-item"
									whileTap={{ scale: 0.96 }}
									whileHover={{ y: -2 }}
									onClick={() => setSelected(r.id)}
								>
									<span className="rp-item-ico">{r.emoji}</span>
									<span className="rp-item-name">{r.title}</span>
									<span className="rp-item-desc">{r.subtitle}</span>
									<span className="rp-item-arrow">→</span>
								</motion.button>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.aside>
	);
}
