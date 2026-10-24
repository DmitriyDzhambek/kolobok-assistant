import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Kolobok } from "./components/Kolobok";
import { Background } from "./components/Background";
import { MacroPanel } from "./components/MacroPanel";
import { RecipePanel } from "./components/RecipePanel";
import { MorningMagic } from "./components/MorningMagic";
import { ChatPanel } from "./components/ChatPanel";
import { useSWUpdate } from "./hooks/useSWUpdate";
import { PartnersPanel } from "./components/PartnersPanel";
import { AdminPanel } from "./components/AdminPanel";
import { ProactiveGreeting } from "./components/ProactiveGreeting";
import { LifeOrchestratorDashboard } from "./components/LifeOrchestratorDashboard";
import {
	QuickActions,
	recipeOfTheDay,
	type QuickAction,
} from "./components/QuickActions";
import { useConnection } from "./net/connection";
import { initTma } from "./tma";
import { isAdmin } from "./auth/admin";
import { useNotifications } from "./hooks/useNotifications";
import { useMacro } from "./macro/useMacro";
import { useRecognition } from "./speech/useRecognition";
import { useSpeech } from "./speech/useSpeech";
import {
	runCommand,
	type Link,
	type TaskItem,
	type Ctx,
} from "./brain/commands";
import { getTimeContext, shouldShowGreeting } from "./utils/timeContext";
import { FirefliesCanvas } from "./components/FirefliesCanvas";
import "./styles.css";

type Chip = {
	id: string;
	kind: "timer" | "reminder";
	text: string;
	endsAt: number;
	total: number;
};
type BotState = "idle" | "listen" | "think" | "speak";

const DEFAULT_HINT =
	"Нажмите — говорить. Удерживайте (или пробел) — диктовка любой длины, отпустите — отправлю.";

function uid() {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function errHint(code: string): string {
	if (code === "not-allowed" || code === "service-not-allowed")
		return "Микрофон запрещён. В Windows: Параметры → Конфиденциальность → Микрофон → разрешить приложениям доступ к микрофону.";
	if (code === "audio-capture")
		return "Микрофон не найден — подключите его или выберите в студии звука Windows (Параметры → Система → Звук).";
	if (code === "network")
		return "Распознаванию речи нужен интернет — проверьте соединение.";
	return (
		"Ошибка голосового ввода (" +
		code +
		"). Попробуйте ещё раз или напишите задачу клавиатурой."
	);
}

function fmtLeft(ms: number): string {
	const s = Math.max(0, Math.ceil(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	const mm = String(m).padStart(2, "0");
	const sss = String(ss).padStart(2, "0");
	return h > 0 ? `${h}:${mm}:${sss}` : `${mm}:${sss}`;
}

const HELP_ITEMS: [string, string][] = [
	["«открой ютуб / почту / yandex.ru»", "откроет сайт в новой вкладке"],
	["«найди рецепт борща»", "карточка рецепта прямо в Колобке, без браузера"],
	[
		"Кнопка 🍲 на панели",
		"волшебная книга рецептов: 19 блюд, категории, избранное ♥",
	],
	["«таймер на 10 минут»", "таймер с голосовым звоном"],
	["«напомни позвонить маме через час»", "напоминание"],
	["«задача: сдать отчёт»", "запишет в список задач"],
	["«список задач» / «выполнено отчёт»", "покажет и отметит задачи"],
	["«посчитай 25*4+10»", "счёт"],
	["«который час», «какое сегодня число»", "время и дата"],
	["«погода в Твери»", "погода без ключей API"],
	["«записать макрос» → F8/ESC", "автокликер: запись кликов и движений мыши"],
	[
		"«запусти макрос 10 раз» → F9 стоп",
		"повтор записи по кругу — для игрового контента",
	],
	[
		"Вкладка «✨ Магия утра»",
		"привычки-созвездия, стрики и мотивация (нужен бэкенд)",
	],
	["Вкладка «💬 Чат»", "разговор с Колобком: LLM по ключу или офлайн-характер"],
	["«расскажи сказку / шутку / пословицу»", "сказочное настроение"],
	[
		"Пробел или кнопка микрофона",
		"нажмите — говорить, удерживайте — диктовка, отпустите — отправить",
	],
];

export default function App() {
	const [botState, setBotState] = useState<BotState>("idle");
	const [botText, setBotText] = useState(
		"Здравствуй, друже! Я — Колобок, сказочный богатырь твоего рабочего стола. Скажи: «открой ютуб», «таймер на 10 минут», «задача: позвонить клиенту» — или просто поговори со мной. Ты отдыхай, а я для тебя заработаю!",
	);
	const [botLink, setBotLink] = useState<Link | null>(null);
	const [interim, setInterim] = useState("");
	const [hint, setHint] = useState(DEFAULT_HINT);
	const [tasks, setTasks] = useState<TaskItem[]>(() => {
		try {
			const raw = localStorage.getItem("kolobok-tasks");
			return raw ? (JSON.parse(raw) as TaskItem[]) : [];
		} catch {
			return [];
		}
	});
	const [chips, setChips] = useState<Chip[]>([]);
	const [now, setNow] = useState(Date.now());
	const [muted, setMuted] = useState(false);
	const [showKeys, setShowKeys] = useState(false);
	const [showHelp, setShowHelp] = useState(false);
	const [showNotifs, setShowNotifs] = useState(false);
	const [updateDismissed, setUpdateDismissed] = useState(false);
	const [greetingDismissed, setGreetingDismissed] = useState(false);
	const [greetingContext, setGreetingContext] = useState<{
		greeting: string;
		systemPrompt: string;
	} | null>(null);
	const [showMacro, setShowMacro] = useState(() => {
		try {
			return (
				typeof window !== "undefined" &&
				new URLSearchParams(window.location.search).has("macro")
			);
		} catch {
			return false;
		}
	});
	const [recipeView, setRecipeView] = useState<{
		open: boolean;
		query?: string;
		id?: string;
	}>(() => {
		try {
			const p =
				typeof window !== "undefined" &&
				new URLSearchParams(window.location.search).get("recipe");
			if (p === null) return { open: false };
			if (!p) return { open: true };
			return /^[a-z][a-z0-9-]*$/.test(p)
				? { open: true, id: p }
				: { open: true, query: p };
		} catch {
			return { open: false };
		}
	});
	const [input, setInput] = useState("");
	const [installEvt, setInstallEvt] = useState<any>(null);
	const [chatAuto, setChatAuto] = useState<string | null>(null);
	const [tab, setTab] = useState<"main" | "morning" | "chat" | "partners" | "orchestrator" | "admin">(() => {
		try {
			const p =
				typeof window !== "undefined" &&
				new URLSearchParams(window.location.search).get("tab");
			const allowed =
				p === "morning" || p === "chat" || p === "partners" || p === "orchestrator" || p === "admin";
			// Вкладка «Админ» недоступна без прав — падаем на главную.
			if (p === "admin" && !isAdmin()) return "main";
			return allowed ? p : "main";
		} catch {
			return "main";
		}
	});

	// Права администратора: вкладка «👑 Админ» рендерится только для своих.
	const admin = isAdmin();

	useEffect(() => {
		initTma();
	}, []);

	// Проактивное приветствие при загрузке
	useEffect(() => {
		if (greetingDismissed || !shouldShowGreeting()) return;

		const ctx = getTimeContext();
		setGreetingContext({
			greeting: ctx.greeting,
			systemPrompt: ctx.systemPrompt,
		});

		// Озвучка приветствия (если браузер позволяет)
		const announceGreeting = () => {
			speakRef.current(ctx.greeting);
			setBotText(ctx.greeting);
		};

		// Автоматическая озвучка с задержкой
		const timer = setTimeout(announceGreeting, 2000);

		return () => clearTimeout(timer);
	}, []);

	// Проверка обновлений Service Worker (для PWA — расширения на рабочем столе).
	const { updateAvailable, installUpdate } = useSWUpdate();

	// Система уведомлений от Колобка.
	const { notifs, addNotif, markAsRead, dismiss, dismissAll } = useNotifications();

	// Общий «живой канал» с бэкендом стартует сразу (WebSocket + авто-реконнект).
	useConnection();
	const macro = useMacro();
	const macroRef = useRef(macro);
	macroRef.current = macro;

	const tasksRef = useRef(tasks);
	tasksRef.current = tasks;
	const chipsRef = useRef(chips);
	chipsRef.current = chips;

	const { speak } = useSpeech(muted, (on) =>
		setBotState((s) => (on === "speak" ? "speak" : s === "speak" ? "idle" : s)),
	);
	const speakRef = useRef(speak);
	speakRef.current = speak;

	const announce = (text: string, link?: Link | null) => {
		setBotText(text);
		setBotLink(link ?? null);
		speakRef.current(text);
	};
	const announceRef = useRef(announce);
	announceRef.current = announce;

	const processText = async (text: string) => {
		const t = text.trim();
		if (!t) return;
		setInterim("");
		setBotState("think");
		const ctx: Ctx = {
			tasks: tasksRef.current,
			addTask: (txt) =>
				setTasks((p) => [...p, { id: uid(), text: txt, done: false }]),
			completeTask: (match) => {
				const open = tasksRef.current.filter((x) => !x.done);
				const nm = (s: string) => s.toLowerCase().replace(/ё/g, "е");
				const target = match
					? open.find((x) => nm(x.text).includes(nm(match)))
					: open[0];
				if (!target) return null;
				setTasks((p) =>
					p.map((x) => (x.id === target.id ? { ...x, done: true } : x)),
				);
				return target.text;
			},
			clearTasks: () => setTasks([]),
			pushChip: (kind, txt, ms) => {
				try {
					if ("Notification" in window && Notification.permission === "default")
						void Notification.requestPermission();
				} catch {
					/* noop */
				}
				setChips((p) => [
					...p,
					{ id: uid(), kind, text: txt, endsAt: Date.now() + ms, total: ms },
				]);
			},
			macro: macroRef.current.ctl,
		};
		try {
			const res = await runCommand(t, ctx);
			if (res.recipe) {
				setTab("main");
				setRecipeView({ open: true, ...res.recipe });
			}
			announceRef.current(res.reply, res.link ?? null);
		} catch {
			announceRef.current(
				"Ох, магия моя заискрила… Повтори, друже, ещё разок.",
			);
		}
	};
	const processRef = useRef(processText);
	processRef.current = processText;

	const rec = useRecognition({
		onFinal: (t) => processRef.current(t),
		onInterim: setInterim,
		onListening: (b) =>
			setBotState((s) => (b ? "listen" : s === "listen" ? "idle" : s)),
		onError: (code) => setHint(errHint(code)),
	});

	const downAt = useRef(0);
	const pressStart = () => {
		if (rec.listening) {
			rec.stop();
			return;
		}
		setHint(DEFAULT_HINT);
		rec.start();
		downAt.current = Date.now();
	};
	const pressEnd = () => {
		if (!rec.listening) return;
		if (Date.now() - downAt.current >= 250) rec.stop();
	};
	const pressRef = useRef({ pressStart, pressEnd });
	pressRef.current = { pressStart, pressEnd };

	useEffect(() => {
		const kd = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			if (e.code === "Space" && !e.repeat) {
				e.preventDefault();
				pressRef.current.pressStart();
			}
		};
		const ku = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				e.preventDefault();
				pressRef.current.pressEnd();
			}
		};
		window.addEventListener("keydown", kd);
		window.addEventListener("keyup", ku);
		return () => {
			window.removeEventListener("keydown", kd);
			window.removeEventListener("keyup", ku);
		};
	}, []);

	useEffect(() => {
		const iv = setInterval(() => {
			const t = Date.now();
			setNow(t);
			const exp = chipsRef.current.filter((c) => c.endsAt <= t);
			if (exp.length) {
				setChips((p) => p.filter((c) => c.endsAt > t));
				for (const c of exp) {
					const msg =
						c.kind === "timer"
							? `Время вышло! ${c.text ? "Задача: " + c.text : "Часовой колокол прозвенел."}`
							: `Напоминаю! ${c.text}`;
					announceRef.current(msg);
					try {
						if (
							"Notification" in window &&
							Notification.permission === "granted"
						)
							new Notification("Колобок", { body: msg });
					} catch {
						/* noop */
					}
				}
			}
		}, 1000);
		return () => clearInterval(iv);
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem("kolobok-tasks", JSON.stringify(tasks));
		} catch {
			/* noop */
		}
	}, [tasks]);

	useEffect(() => {
		const bip = (e: Event) => {
			e.preventDefault();
			setInstallEvt(e);
		};
		const installed = () => setInstallEvt(null);
		window.addEventListener("beforeinstallprompt", bip);
		window.addEventListener("appinstalled", installed);
		return () => {
			window.removeEventListener("beforeinstallprompt", bip);
			window.removeEventListener("appinstalled", installed);
		};
	}, []);

	const doInstall = async () => {
		if (!installEvt) return;
		try {
			installEvt.prompt();
			await installEvt.userChoice;
		} catch {
			/* noop */
		}
		setInstallEvt(null);
	};

	const openTasks = tasks.filter((t) => !t.done);

	const todaysRecipe = recipeOfTheDay();
	const quickActions: QuickAction[] = [
		{
			id: "recipe",
			emoji: "🍲",
			title: "Рецепт дня",
			desc: `${todaysRecipe.title} — карточка откроется прямо здесь`,
			onClick: () => setRecipeView({ open: true, id: todaysRecipe.id }),
		},
		{
			id: "miniapps",
			emoji: "💰",
			title: "Проверить Mini Apps",
			desc: "Спросить Колобка, как заработать сегодня",
			onClick: () => {
				setTab("chat");
				setChatAuto("Как заработать на Mini Apps?");
			},
		},
		{
			id: "macro",
			emoji: "🖱️",
			title: "Быстрый макрос",
			desc: "Записать клики и повторить N раз",
			onClick: () => setShowMacro((s) => !s),
		},
		{
			id: "morning",
			emoji: "✨",
			title: "Магия утра",
			desc: "Зажечь кристаллы привычек",
			onClick: () => setTab("morning"),
		},
		{
			id: "timer",
			emoji: "⏱️",
			title: "Таймер 5 минут",
			desc: "Засеку и напомню голосом",
			onClick: () => void processText("таймер на 5 минут"),
		},
		{
			id: "weather",
			emoji: "🌤️",
			title: "Погода сейчас",
			desc: "Что надеть на прогулку",
			onClick: () => void processText("погода"),
		},
	];
	return (
		<div className="app">
			<Background />

			{/* Баннер обновления PWA — появляется, когда Service Worker нашёл новую версию */}
			{updateAvailable && !updateDismissed && (
				<div className="update-banner">
					<span className="update-banner-text">
						✨ Колобок обновился! Перезагрузи, чтобы получить новые функции.
					</span>
					<button className="update-banner-btn" onClick={installUpdate}>
						🔄 Обновить
					</button>
					<button
						className="update-banner-close"
						onClick={() => setUpdateDismissed(true)}
						title="Позже"
					>
						✕
					</button>
				</div>
			)}

			<header className="hdr">
				<h1 className="title">Ты отдыхай, а я для тебя заработаю</h1>
				<div className="subtitle">
					Колобок · сказочный голосовой богатырь твоего рабочего стола
				</div>
				{installEvt && (
					<button className="install-btn" onClick={doInstall}>
						⤓ Установить на рабочий стол
					</button>
				)}
			</header>

			{/* Проактивное приветствие */}
			<ProactiveGreeting />

			<nav className="tabs">
				{(
					[
						["main", "🌙 Колобок"],
						["morning", "✨ Магия утра"],
						["chat", "💬 Чат"],
						["partners", "💰 Заработок"],
						["orchestrator", "💰 Wealth (Богатство)"],
						...(admin ? [
							[
								"admin",
								<>
									👑 Админ
									<span className="admin-pulse" title="Секретная зона">🔥</span>
								</>,
							] as ["main" | "morning" | "chat" | "partners" | "orchestrator" | "admin", React.ReactNode],
						] : []),
					] as ["main" | "morning" | "chat" | "partners" | "orchestrator" | "admin", string][]
				).map(([id, label]) => (
					<motion.button
						key={id}
						className={`tab ${tab === id ? "on" : ""}`}
						onClick={() => setTab(id)}
						whileTap={{ scale: 0.95 }}
					>
						{label}
					</motion.button>
				))}
			</nav>

			<AnimatePresence mode="wait" initial={false}>
				{tab === "main" && (
					<motion.main
						key="main"
						className="stage"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.18 }}
					>
						<Kolobok state={botState} />
						<div className={`bubble ${botState === "speak" ? "speaking" : ""}`}>
							<div className="bubble-text">{botText}</div>
							{botLink && (
								<a
									className="bubble-link"
									href={botLink.url}
									target="_blank"
									rel="noopener noreferrer"
								>
									{botLink.label} ↗
								</a>
							)}
						</div>
						<div className="transcript">
							{interim ? "…" + interim : "\u00A0"}
						</div>
						<div className="hint">{hint}</div>

						<div className="chips">
							{chips.map((c) => (
								<div key={c.id} className="chip chip-time">
									<span className="chip-ico">
										{c.kind === "timer" ? "⏳" : "🔔"}
									</span>
									<span className="chip-txt">
										{c.text || (c.kind === "timer" ? "таймер" : "напоминание")}
									</span>
									<b>{fmtLeft(c.endsAt - now)}</b>
								</div>
							))}
							{openTasks.map((t) => (
								<div key={t.id} className="chip chip-task">
									<button
										className="chip-done"
										title="Отметить выполненной"
										onClick={() =>
											setTasks((p) =>
												p.map((x) =>
													x.id === t.id ? { ...x, done: true } : x,
												),
											)
										}
									>
										✓
									</button>
									<span className="chip-txt">{t.text}</span>
									<button
										className="chip-x"
										title="Убрать"
										onClick={() =>
											setTasks((p) => p.filter((x) => x.id !== t.id))
										}
									>
										×
									</button>
								</div>
							))}
						</div>

						<QuickActions actions={quickActions} />
						{showMacro && (
							<MacroPanel
								status={macro.status}
								lastError={macro.lastError}
								ctl={macro.ctl}
							/>
						)}

						<AnimatePresence>
							{recipeView.open && (
								<RecipePanel
									key="recipes"
									initialId={recipeView.id}
									initialQuery={recipeView.query}
									onClose={() => setRecipeView((v) => ({ ...v, open: false }))}
								/>
							)}
						</AnimatePresence>

						{showKeys && (
							<form
								className="kbrow"
								onSubmit={(e) => {
									e.preventDefault();
									if (input.trim()) {
										void processText(input);
										setInput("");
									}
								}}
							>
								<input
									value={input}
									onChange={(e) => setInput(e.target.value)}
									placeholder="Напиши задачу словами… например: таймер на 7 минут"
									autoFocus
								/>
								<button type="submit">Отправить</button>
							</form>
						)}
					</motion.main>
				)}

				{tab === "morning" && (
					<motion.div
						key="morning"
						className="tabpage"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.18 }}
					>
						<MorningMagic />
					</motion.div>
				)}

				{tab === "chat" && (
					<motion.div
						key="chat"
						className="tabpage"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.18 }}
					>
						<ChatPanel
							muted={muted}
							speak={speak}
							speaking={botState === "speak"}
							autoAsk={chatAuto}
							onAutoAsked={() => setChatAuto(null)}
							timeContext={greetingContext?.systemPrompt}
						/>
					</motion.div>
				)}

				{tab === "partners" && (
					<motion.div
						key="partners"
						className="tabpage"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.18 }}
					>
						<PartnersPanel />
					</motion.div>
				)}

				{tab === "orchestrator" && (
					<motion.div
						key="orchestrator"
						className="tabpage"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.18 }}
					>
						<LifeOrchestratorDashboard />
					</motion.div>
				)}

				{tab === "admin" && (
					<motion.div
						key="admin"
						className="tabpage"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.18 }}
					>
						<AdminPanel />
					</motion.div>
				)}
			</AnimatePresence>

			<footer className="toolbar">
				<button
					className={`tb mic ${rec.listening ? "on" : ""}`}
					onPointerDown={pressStart}
					onPointerUp={pressEnd}
					onPointerLeave={pressEnd}
					title="Микрофон: нажмите или удерживайте пробел"
				>
					<svg
						viewBox="0 0 24 24"
						width="26"
						height="26"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					>
						<rect x="9" y="3" width="6" height="11" rx="3" />
						<path d="M5 11a7 7 0 0 0 14 0" />
						<path d="M12 18v3" />
					</svg>
				</button>
				<button
					className={`tb ${muted ? "off" : ""}`}
					onClick={() => setMuted((m) => !m)}
					title={muted ? "Включить голос Колобка" : "Тихий режим"}
				>
					{muted ? (
						<svg
							viewBox="0 0 24 24"
							width="22"
							height="22"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						>
							<path d="M11 5 6 9H3v6h3l5 4z" />
							<path d="m16 9 5 5M21 9l-5 5" />
						</svg>
					) : (
						<svg
							viewBox="0 0 24 24"
							width="22"
							height="22"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						>
							<path d="M11 5 6 9H3v6h3l5 4z" />
							<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
						</svg>
					)}
				</button>
				<button
					className={`tb ${showKeys ? "on" : ""}`}
					onClick={() => setShowKeys((s) => !s)}
					title="Ввод с клавиатуры"
				>
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					>
						<rect x="2.5" y="6" width="19" height="12" rx="2" />
						<path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" />
					</svg>
				</button>
				<button
					className={`tb macro ${showMacro ? "on" : ""}`}
					onClick={() => setShowMacro((s) => !s)}
					title="Автокликер: запись и повтор макросов"
				>
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					>
						<rect x="7" y="2.5" width="10" height="19" rx="5" />
						<path d="M12 6.5v3.5" />
					</svg>
				</button>
				<button
					className={`tb recipe ${recipeView.open ? "on" : ""}`}
					onClick={() => setRecipeView((v) => ({ ...v, open: !v.open }))}
					title="Волшебная книга рецептов"
				>
					<span className="tb-emoji">🍲</span>
				</button>
				<button
					className={`tb ${showHelp ? "on" : ""}`}
					onClick={() => setShowHelp((s) => !s)}
					title="Помощь и команды"
				>
					<span className="qmark">?</span>
				</button>
				<button
					className={`tb notif ${showNotifs ? "on" : ""}`}
					onClick={() => setShowNotifs((s) => !s)}
					title="Уведомления от Колобка"
				>
					🔔
					{notifs.some((n) => !n.read) && (
						<span className="notif-badge">{notifs.filter((n) => !n.read).length}</span>
					)}
				</button>
			</footer>

			{!rec.supported && (
				<div className="nosupport">
					Браузер не поддерживает голосовой ввод — откройте в Google Chrome или
					пишите задачи клавиатурой (кнопка с клавиатурой).
				</div>
			)}

			{showNotifs && (
				<div className="overlay" onClick={() => setShowNotifs(false)}>
					<div className="notif-panel" onClick={(e) => e.stopPropagation()}>
						<div className="notif-header">
							<h2>🔔 Уведомления от Колобка</h2>
							<button className="notif-clear" onClick={dismissAll}>
								Очистить всё
							</button>
						</div>
						{notifs.length === 0 ? (
							<div className="notif-empty">
								<p>🫓 Колобок ещё ничего не сказал...</p>
								<small>Уведомления будут появляться, когда Колобок что-то напомнит</small>
							</div>
						) : (
							<ul className="notif-list">
								{notifs.map((n) => (
									<li
										key={n.id}
										className={`notif-item ${n.read ? "read" : "unread"}`}
										onClick={() => markAsRead(n.id)}
									>
										<div className="notif-dot" />
										<div className="notif-content">
											<div className="notif-text">{n.message}</div>
											<div className="notif-time">
												{new Date(n.time).toLocaleString("ru-RU")}
											</div>
										</div>
										<button
											className="notif-dismiss"
											onClick={(e) => {
												e.stopPropagation();
												dismiss(n.id);
											}}
										>
											✕
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			)}

			{showHelp && (
				<div className="overlay" onClick={() => setShowHelp(false)}>
					<div className="help-panel" onClick={(e) => e.stopPropagation()}>
						<h2>Волшебная грамота Колобка</h2>
						<ul>
							{HELP_ITEMS.map(([cmd, desc]) => (
								<li key={cmd}>
									<b>{cmd}</b> — {desc}
								</li>
							))}
						</ul>
						<p className="help-note">
							На Windows 10: откройте сайт в Chrome → меню → «Установить
							Колобок…» — и помощник поселится на рабочем столе как приложение.
							Для автозапуска положите ярлык в папку автозагрузки (Win+R →
							shell:startup).
						</p>
						<button className="help-close" onClick={() => setShowHelp(false)}>
							Закрыть
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
