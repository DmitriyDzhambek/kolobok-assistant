/**
 * FoodTerminal — «Гастрономический Терминал».
 *
 * Еда как актив. Биржевой терминал с милыми иконками еды.
 * Фичи:
 *  1. Сканер Холодильника (Fridge Scanner) — Drag&Drop фото → рецепт за 0 ₽
 *  2. Антистресс-Рацион (Mood-Based Diet) — привязка к portfolioStatus
 *  3. Биржа Еды (Food Arbitrage Ticker) — бегущая строка с ценами продуктов
 *  4. Копилка на бирже (Savings Jar) — анимированная SVG-банка с монетками
 *  5. Режим «Инвестор-Демо» — финансовая выгода для питча
 *
 * Advisory Mode: никаких кнопок покупки, только советы.
 */

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Scan,
	ArrowDown,
	ArrowUp,
	Banknote,
	Activity,
	Sun,
	Moon,
	Leaf,
	LayoutGrid,
	BarChart3,
	X,
	Sparkles,
	Users,
	HandCoins,
	Coins,
} from "lucide-react";

/* ─────────────────────── типы ─────────────────────── */

export type PortfolioMood = "profit" | "loss" | "neutral";

interface FridgeItem {
	name: string;
	emoji: string;
	price: number;
}

interface FoodArbitrageItem {
	ticker: string;
	product: string;
	price: number;
	change: number;
	store: string;
}

interface SavingsStat {
	total: number;
	coins: number;
	lastMeal: string;
}

/* ─────────────────────── данные ─────────────────────── */

const MOCK_FRIDGE: FridgeItem[] = [
	{ name: "Яйца (2 шт)", emoji: "🥚", price: 15 },
	{ name: "Половинка луковицы", emoji: "🧅", price: 3 },
	{ name: "Остатки сыра", emoji: "🧀", price: 25 },
	{ name: "Вчерашний рис", emoji: "🍚", price: 8 },
];

const MOCK_RECIPES: Record<string, { title: string; desc: string; ingredients: string[] }> = {
	stress: {
		title: "Бюджетный антидепрессант",
		desc: "Бананы и тёмный шоколад — магний для нервов. На рынке шторм, не трать лишнего.",
		ingredients: ["1 банан", "30 г тёмного шоколада", "100 мл молока"],
	},
	profit: {
		title: "Белковый бустер",
		desc: "Куриная грудка и киноа — зарядись энергией для новых побед!",
		ingredients: ["150 г куриной грудки", "80 г киноа", "Лимонный сок"],
	},
	neutral: {
		title: "Сбалансированный обед",
		desc: "Умеренный рацион: белки + углеводы + клетчатка. Рабочий день впереди.",
		ingredients: ["Гречка", "Куриное филе", "Огурец свежий"],
	},
	fridge: {
		title: "Спасено от утилизации",
		desc: "Не выбрасываем! Всё, что есть в холодильнике, превращается в ужин.",
		ingredients: MOCK_FRIDGE.map((i) => `${i.emoji} ${i.name}`),
	},
};

const FOOD_TICKER_DATA: FoodArbitrageItem[] = [
	{ ticker: "ЧИЖИК", product: "КУРИЦА", price: 189, change: -15, store: "Чижик" },
	{ ticker: "МАГНИТ", product: "ГРЕЧКА", price: 95, change: -10, store: "Магнит" },
	{ ticker: "ПЯТЁРОЧКА", product: "МОЛОКО", price: 72, change: 2, store: "Пятёрочка" },
	{ ticker: "ЧИЖИК", product: "СЫР", price: 680, change: -8, store: "Чижик" },
	{ ticker: "ВКУСВИЛЛ", product: "КИНОА", price: 210, change: -5, store: "ВкусВилл" },
	{ ticker: "ПЯТЁРОЧКА", product: "ЯБЛОКИ", price: 89, change: 3, store: "Пятёрочка" },
	{ ticker: "МАГНИТ", product: "МОЛОКО", price: 68, change: -2, store: "Магнит" },
	{ ticker: "ЧИЖИК", product: "БАНАНЫ", price: 110, change: -12, store: "Чижик" },
];

const INVESTOR_STATS = {
	avgCheck: 2500,
	commission: 3,
	monthlyRevenue: 2250,
	partners: ["Чижик", "Магнит", "ВкусВилл", "Вкусно — и точка"],
};

/* ─────────────────────── Food Arbitrage Ticker (CSS-анимация, без rAF) ─────────────────────── */

function FoodArbitrageTicker({
	selectedStore,
	onStoreSelect,
}: {
	selectedStore?: string;
	onStoreSelect?: (store: string) => void;
}) {
	return (
		<div className="ft-ticker-wrap">
			<div className="ft-ticker-label">
				<Activity className="ft-ticker-label__icon" />
				Биржа Еды — Live
			</div>
			<div className="ft-ticker">
				<div className="ft-ticker-track">
					{[...FOOD_TICKER_DATA, ...FOOD_TICKER_DATA].map((item, i) => {
						const isDown = item.change < 0;
						const isSelected = selectedStore === item.store;

						return (
							<div
								key={i}
								className={`ft-ticker-item ${isDown ? "ft-ticker--down" : "ft-ticker--up"} ${isSelected ? "ft-ticker--selected" : ""}`}
								onClick={() => onStoreSelect?.(item.store)}
								style={{ cursor: "pointer" }}
							>
								<span className="ft-ticker-ticker">[{item.ticker}]</span>
								<span className="ft-ticker-product">{item.product}</span>
								<span className="ft-ticker-price">{item.price} ₽</span>
								<span className="ft-ticker-change">
									{isDown ? (
										<ArrowDown className="inline w-3 h-3 mr-0.5" />
									) : (
										<ArrowUp className="inline w-3 h-3 mr-0.5" />
									)}
									{Math.abs(item.change)}%
								</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

/* ─────────────────────── Fridge Scanner ─────────────────────── */

function FridgeScanner({
	onRecipeFound,
}: {
	onRecipeFound?: () => void;
}) {
	const [scanning, setScanning] = useState(false);
	const [scanned, setScanned] = useState(false);
	const [dragOver, setDragOver] = useState(false);

	const startScan = useCallback(() => {
		setScanning(true);
		setScanned(false);
		setTimeout(() => {
			setScanning(false);
			setScanned(true);
			onRecipeFound?.();
		}, 2000);
	}, [onRecipeFound]);

	return (
		<div className="ft-scan">
			<div className="ft-scan__header">
				<Scan className="ft-scan__icon" />
				<div>
					<div className="ft-scan__title">Сканер Холодильника</div>
					<div className="ft-scan__subtitle">
						Сфоткай полки — Колобок найдёт рецепт из того, что есть
					</div>
				</div>
			</div>

			{/* Drag & Drop зона */}
			<div
				className={`ft-dropzone ${dragOver ? "ft-dropzone--active" : ""} ${scanning ? "ft-dropzone--scanning" : ""}`}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragOver(false);
					startScan();
				}}
				onClick={startScan}
			>
				<AnimatePresence mode="wait">
					{scanning ? (
						<motion.div
							key="scanning"
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							className="ft-scan-line"
						>
							<div className="ft-scan-line__bar" />
							<div className="ft-scan-line__text">
								Колобок сканирует содержимое холодильника…
							</div>
						</motion.div>
					) : scanned ? (
						<motion.div
							key="scanned"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="ft-scan-result"
						>
							<Sparkles className="ft-scan-result__icon" />
							<div className="ft-scan-result__title">
								Нашёл продукты!
							</div>
							<div className="ft-scan-result__items">
								{MOCK_FRIDGE.map((item, idx) => (
									<span key={idx} className="ft-scan-result__item">
										{item.emoji} {item.name}
									</span>
								))}
							</div>
							<div className="ft-scan-result__badge">
								💰 Спасено от утилизации:{" "}
								{MOCK_FRIDGE.reduce((sum, item) => sum + item.price, 0)} ₽
							</div>
						</motion.div>
					) : (
						<motion.div
							key="idle"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="ft-scan-idle"
						>
							<span className="ft-scan-idle__emoji">📸</span>
							<div>Перетащи фото холодильника сюда</div>
							<div className="ft-scan-idle__hint">
								или нажми для демо-сканирования
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

/* ─────────────────────── Savings Jar (SVG) ─────────────────────── */

function SavingsJar({
	stats,
}: {
	stats: SavingsStat;
}) {
	const [drops, setDrops] = useState<{ id: number; x: number }[]>([]);

	const addCoin = useCallback(() => {
		setDrops((prev) => [
			...prev,
			{ id: Date.now(), x: Math.random() * 40 + 20 },
		]);
	}, []);

	return (
		<div className="ft-jar">
			<div className="ft-jar__header">
				<Banknote className="ft-jar__icon" />
				<div className="ft-jar__title">Копилка на бирже</div>
			</div>

			<div className="ft-jar__body">
				{/* SVG банка */}
				<svg viewBox="0 0 120 140" className="ft-jar__svg">
					<defs>
						<linearGradient id="jarGrad" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0%" stopColor="rgba(255, 215, 102, 0.3)" />
							<stop offset="100%" stopColor="rgba(255, 215, 102, 0.05)" />
						</linearGradient>
					</defs>
					<rect
						x="20"
						y="40"
						width="80"
						height="90"
						rx="12"
						fill="url(#jarGrad)"
						stroke="rgba(255, 215, 102, 0.5)"
						strokeWidth="2"
					/>
					<rect
						x="35"
						y="25"
						width="50"
						height="20"
						rx="6"
						fill="rgba(255, 215, 102, 0.2)"
						stroke="rgba(255, 215, 102, 0.6)"
						strokeWidth="2"
					/>
					<rect
						x="30"
						y="18"
						width="60"
						height="10"
						rx="4"
						fill="rgba(255, 215, 102, 0.4)"
					/>

					{/* Монетки внутри */}
					{Array.from({ length: Math.min(stats.coins, 15) }).map((_, idx) => (
						<circle
							key={idx}
							cx={35 + (idx % 5) * 12}
							cy={110 - Math.floor(idx / 5) * 10}
							r="5"
							fill="rgba(255, 215, 102, 0.7)"
						/>
					))}

					{/* Анимация падающих монеток */}
					<AnimatePresence>
						{drops.map((drop) => (
							<motion.circle
								key={drop.id}
								cx={drop.x}
								cy={20}
								r="5"
								fill="#ffd766"
								initial={{ opacity: 1, y: 0 }}
								animate={{ y: 100, opacity: 0 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.8, ease: "easeIn" }}
							/>
						))}
					</AnimatePresence>
				</svg>

				{/* Сумма */}
				<div className="ft-jar__amount">{stats.total} ₽</div>
				<div className="ft-jar__label">не отдал за бизнес-ланч</div>
				<div className="ft-jar__prediction">
					Уже завтра Колобок превратит их в{" "}
					<b>{(stats.total / 2250).toFixed(1)} акций Сбера</b>
				</div>

				{/* Кнопка добавить монетку */}
				<motion.button
					className="ft-jar__btn"
					whileTap={{ scale: 0.95 }}
					onClick={addCoin}
				>
					<Coins className="ft-jar__btn__icon" />
					Добавить монетку
				</motion.button>
			</div>
		</div>
	);
}

/* ─────────────────────── Investor Demo Panel ─────────────────────── */

function InvestorDemoPanel({
	onClose,
}: {
	onClose: () => void;
}) {
	return (
		<motion.div
			className="ft-investor"
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -20 }}
		>
			<div className="ft-investor__header">
				<BarChart3 className="ft-investor__icon" />
				<div className="ft-investor__title">Инвестор-Демо: Бизнес-модель</div>
				<button className="ft-investor__close" onClick={onClose}>
					<X className="w-4 h-4" />
				</button>
			</div>

			<div className="ft-investor__grid">
				<div className="ft-investor__card">
					<HandCoins className="ft-investor__card__icon" />
					<div className="ft-investor__card__value">
						{INVESTOR_STATS.avgCheck.toLocaleString("ru-RU")} ₽
					</div>
					<div className="ft-investor__card__label">
						Средний чек пользователя на еду в месяц
					</div>
				</div>

				<div className="ft-investor__card">
					<HandCoins className="ft-investor__card__icon" />
					<div className="ft-investor__card__value">
						{INVESTOR_STATS.commission}%
					</div>
					<div className="ft-investor__card__label">
						Партнёрская комиссия с магазинов
					</div>
				</div>

				<div className="ft-investor__card ft-investor__card--highlight">
					<HandCoins className="ft-investor__card__icon" />
					<div className="ft-investor__card__value">
						{INVESTOR_STATS.monthlyRevenue.toLocaleString("ru-RU")} ₽
					</div>
					<div className="ft-investor__card__label">
						Доход с одного пользователя в месяц
					</div>
				</div>

				<div className="ft-investor__card">
					<Users className="ft-investor__card__icon" />
					<div className="ft-investor__card__value">
						{INVESTOR_STATS.partners.length}
					</div>
					<div className="ft-investor__card__label">
						Партнёры: {INVESTOR_STATS.partners.join(", ")}
					</div>
				</div>
			</div>

			<div className="ft-investor__footer">
				🎯 <b>Вывод:</b> Каждый пользователь экономит ~{INVESTOR_STATS.monthlyRevenue} ₽/мес на еде,
				а Колобок зарабатывает {INVESTOR_STATS.commission}% с партнёрских покупок.
				При 10 000 MAU — <b>{(INVESTOR_STATS.monthlyRevenue * 10000).toLocaleString("ru-RU")} ₽/мес</b> выручки.
			</div>
		</motion.div>
	);
}

/* ─────────────────────── Главный компонент ─────────────────────── */

export function FoodTerminal({
	portfolioStatus,
}: {
	portfolioStatus?: PortfolioMood;
}) {
	const [selectedStore, setSelectedStore] = useState<string>("");
	const [showInvestor, setShowInvestor] = useState(false);
	const [saved, setSaved] = useState(false);

	const [savings, setSavings] = useState<SavingsStat>({
		total: 450,
		coins: 7,
		lastMeal: "Борщ",
	});

	// Антистресс-рацион на основе портфеля
	const moodRecipe = useMemo(() => {
		const status = portfolioStatus ?? "neutral";
		return MOCK_RECIPES[status];
	}, [portfolioStatus]);

	const handleStoreSelect = useCallback((store: string) => {
		setSelectedStore(store);
	}, []);

	const handleRecipeSave = useCallback(() => {
		setSaved(true);
		setSavings((prev) => ({
			...prev,
			total: prev.total + 50,
			coins: prev.coins + 1,
		}));
		setTimeout(() => setSaved(false), 2000);
	}, []);

	return (
		<div className="ft-terminal">
			{/* ── Шапка ── */}
			<div className="ft-header">
				<div className="ft-header__left">
					<Sparkles className="ft-header__icon" />
					<div>
						<div className="ft-header__title">Гастрономический Терминал</div>
						<div className="ft-header__subtitle">
							Еда — это тоже актив. Экономя на завтраках, инвестируй в будущее.
						</div>
					</div>
				</div>
				<div className="ft-header__right">
					<motion.button
						className="ft-btn ft-btn--investor"
						whileTap={{ scale: 0.95 }}
						onClick={() => setShowInvestor((p) => !p)}
					>
						<LayoutGrid className="ft-btn__icon" />
						Режим Питча
					</motion.button>
					<motion.button
						className="ft-btn ft-btn--scan"
						whileTap={{ scale: 0.95 }}
						onClick={() => setShowInvestor(false)}
					>
						<Scan className="ft-btn__icon" />
						Сканер
					</motion.button>
					<motion.button
						className="ft-btn ft-btn--grid"
						whileTap={{ scale: 0.95 }}
						onClick={() => setShowInvestor(false)}
					>
						<LayoutGrid className="ft-btn__icon" />
						Рецепты
					</motion.button>
				</div>
			</div>

			{/* ── Биржа Еды (бегущая строка) ── */}
			<FoodArbitrageTicker
				selectedStore={selectedStore}
				onStoreSelect={handleStoreSelect}
			/>

			{/* ── Основной контент ── */}
			<div className="ft-grid">
				{/* Левая колонка: антистресс-рацион + сканер */}
				<div className="ft-left">
					{/* Антистресс-рацион */}
					<div className="ft-mood">
						<div className="ft-mood__header">
							{portfolioStatus === "profit" ? (
								<Sun className="ft-mood__icon ft-mood__icon--profit" />
							) : portfolioStatus === "loss" ? (
								<Moon className="ft-mood__icon ft-mood__icon--loss" />
							) : (
								<Leaf className="ft-mood__icon ft-mood__icon--neutral" />
							)}
							<div>
								<div className="ft-mood__title">
									Антистресс-Рацион
								</div>
								<div className="ft-mood__subtitle">
									Подбирается по состоянию портфеля
								</div>
							</div>
						</div>

						<div className="ft-mood__card">
							<div className="ft-mood__card__title">{moodRecipe.title}</div>
							<div className="ft-mood__card__desc">{moodRecipe.desc}</div>
							<div className="ft-mood__card__ingredients">
								{moodRecipe.ingredients.map((ing, idx) => (
									<span key={idx} className="ft-mood__card__ing">
										{ing}
									</span>
								))}
							</div>
							<motion.button
								className="ft-mood__card__btn"
								whileTap={{ scale: 0.96 }}
								onClick={handleRecipeSave}
							>
								{saved ? "✓ Сохранено!" : "Приготовить и сэкономить →"}
							</motion.button>
						</div>

						{selectedStore && (
							<motion.div
								className="ft-arbitrage-win"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
							>
								🎉 <b>Арбитражная сделка совершена!</b> Ты сэкономил 240 ₽, выбрав {selectedStore} вместо Пятёрочки.
							</motion.div>
						)}
					</div>

					{/* Сканер */}
					<FridgeScanner />
				</div>

				{/* Правая колонка: копилка */}
				<div className="ft-right">
					<SavingsJar stats={savings} />
				</div>
			</div>

			{/* ── Инвестор-Демо ── */}
			<AnimatePresence>
				{showInvestor && (
					<InvestorDemoPanel onClose={() => setShowInvestor(false)} />
				)}
			</AnimatePresence>
		</div>
	);
}
