import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, isNetworkError } from "../api/client";
import { useConnection, type ConnState } from "../net/connection";
import { useRecognition } from "../speech/useRecognition";

type Msg = {
	id: string;
	role: "user" | "assistant";
	content: string;
	/** Служебная «волшебная» заметка — не уходит в историю LLM. */
	note?: boolean;
};

const WELCOME =
	"Привет! Я — Колобок, сказочный, но очень прокачанный ИИ-ассистент. Помогаю зарабатывать (Telegram Mini Apps, инвестиции, курьерство), вести «Магию утра» и не терять мотивацию. Спроси что-нибудь — текстом или голосом!";

/** Ровно тот текст, который видит пользователь при потере связи.
 * Никаких команд, путей к файлам и красных алертов. */
const OFFLINE_NOTE =
	"Ой, кажется, я потерял связь с волшебным лесом (сервером). Но ты не расстраивайся! Я уже чиню свои невидимые шестеренки. Попробуй написать мне чуть позже.";

const RECONNECT_NOTE = "Ура! Я снова с тобой на связи!";

const QUICK = [
	"Как заработать на Mini Apps?",
	"Какую привычку внедрить завтра?",
	"Мотивируй меня!",
];

function uid() {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Маленькое лицо Колобка — аватар сообщений ассистента. */
function KolobokFace({ size = 24 }: { size?: number }) {
	return (
		<svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
			<circle
				cx="16"
				cy="16"
				r="14.5"
				fill="#ffd76a"
				stroke="#e0a72e"
				strokeWidth="1.4"
			/>
			<circle cx="11.3" cy="13" r="1.9" fill="#3a2a10" />
			<circle cx="20.7" cy="13" r="1.9" fill="#3a2a10" />
			<path
				d="M10 20 Q16 25.5 22 20"
				stroke="#3a2a10"
				strokeWidth="1.9"
				fill="none"
				strokeLinecap="round"
			/>
			<circle cx="7.5" cy="18" r="2" fill="#ffb347" opacity="0.55" />
			<circle cx="24.5" cy="18" r="2" fill="#ffb347" opacity="0.55" />
		</svg>
	);
}

/** Спящий Колобок с золотыми звёздочками — состояние подключения. */
function WakeLoader() {
	return (
		<div className="chat-wake" aria-live="polite">
			<div className="wake-kolobok">
				<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden>
					<defs>
						<radialGradient id="wakeGrad" cx="40%" cy="35%" r="75%">
							<stop offset="0%" stopColor="#ffe9a8" />
							<stop offset="100%" stopColor="#f5b83d" />
						</radialGradient>
					</defs>
					<circle
						cx="32"
						cy="32"
						r="27"
						fill="url(#wakeGrad)"
						stroke="#e0a72e"
						strokeWidth="1.6"
					/>
					<path
						d="M19 28 q4.5 4.5 9 0"
						stroke="#5a3d12"
						strokeWidth="2.6"
						fill="none"
						strokeLinecap="round"
					/>
					<path
						d="M36 28 q4.5 4.5 9 0"
						stroke="#5a3d12"
						strokeWidth="2.6"
						fill="none"
						strokeLinecap="round"
					/>
					<path
						d="M24 43 q8 5 16 0"
						stroke="#5a3d12"
						strokeWidth="2.6"
						fill="none"
						strokeLinecap="round"
					/>
					<circle cx="18" cy="37" r="3.4" fill="#ffb347" opacity="0.5" />
					<circle cx="46" cy="37" r="3.4" fill="#ffb347" opacity="0.5" />
				</svg>
				<span className="wake-star s1" aria-hidden>
					✦
				</span>
				<span className="wake-star s2" aria-hidden>
					✦
				</span>
				<span className="wake-star s3" aria-hidden>
					✦
				</span>
			</div>
			<motion.div
				className="wake-text"
				animate={{ opacity: [0.55, 1, 0.55] }}
				transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
			>
				Колобок просыпается и настраивает связь...
			</motion.div>
		</div>
	);
}

/** Чат с «мозгами» Колобка: стеклянные панели, текст + голос.
 * Связь — через общий useConnection: во время подключения спящий Колобок,
 * при потере — «режим тишины» с волшебной заметкой и мягко заблокированным
 * вводом, при восстановлении — радостное сообщение. Без технических текстов. */
export function ChatPanel({
	muted,
	speak,
	autoAsk,
	onAutoAsked,
}: {
	muted: boolean;
	speak: (text: string) => void;
	autoAsk?: string | null;
	onAutoAsked?: () => void;
}) {
	const conn = useConnection();
	const offline = conn === "offline";
	const connecting = conn === "connecting";

	const [msgs, setMsgs] = useState<Msg[]>([
		{ id: "welcome", role: "assistant", content: WELCOME },
	]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const msgsRef = useRef(msgs);
	msgsRef.current = msgs;
	const prevConn = useRef<ConnState>("connecting");

	const addOfflineNote = () =>
		setMsgs((p) =>
			p.some((m) => m.id === "note-offline")
				? p
				: [
						...p,
						{
							id: "note-offline",
							role: "assistant",
							content: OFFLINE_NOTE,
							note: true,
						},
					],
		);

	// Связь пропала/вернулась — волшебные заметки вместо красных алертов.
	useEffect(() => {
		const prev = prevConn.current;
		prevConn.current = conn;
		if (conn === "offline" && prev !== "offline") addOfflineNote();
		if (conn === "online" && prev === "offline") {
			setMsgs((p) => [
				...p.filter((m) => m.id !== "note-offline"),
				{
					id: `note-re-${Date.now()}`,
					role: "assistant",
					content: RECONNECT_NOTE,
					note: true,
				},
			]);
		}
	}, [conn]);

	useEffect(() => {
		const el = listRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [msgs, busy]);

	const send = async (text: string) => {
		const t = text.trim();
		if (!t || busy) return;
		if (offline) {
			addOfflineNote();
			return;
		}
		setErr(null);
		const user: Msg = { id: uid(), role: "user", content: t };
		const history = [...msgsRef.current.filter((m) => !m.note), user];
		setMsgs((p) => [...p, user]);
		setInput("");
		setBusy(true);
		try {
			const payload = history
				.filter((m) => m.id !== "welcome" || history.length === 1)
				.slice(-24)
				.map((m) => ({ role: m.role, content: m.content }));
			const r = await apiFetch("/api/chat", {
				method: "POST",
				body: JSON.stringify({ messages: payload }),
			});
			const reply =
				String(r?.reply ?? "").trim() || "Колобок задумался и промолчал…";
			setMsgs((p) => [...p, { id: uid(), role: "assistant", content: reply }]);
			if (!muted) speak(reply);
		} catch (e) {
			if (isNetworkError(e)) {
				// Связь оборвалась прямо во время отправки — волшебная заметка,
				// текст возвращается в поле ввода.
				setMsgs((p) => [
					...p.filter((x) => x.id !== user.id && x.id !== "note-offline"),
					{
						id: "note-offline",
						role: "assistant",
						content: OFFLINE_NOTE,
						note: true,
					},
				]);
			} else {
				setErr(String((e as Error)?.message ?? e));
				setMsgs((p) => p.filter((x) => x.id !== user.id));
			}
			setInput(t);
		} finally {
			setBusy(false);
		}
	};
	const sendRef = useRef(send);
	sendRef.current = send;

	// «Быстрый вопрос» с карточки главного экрана (QuickActions).
	useEffect(() => {
		if (!autoAsk) return;
		onAutoAsked?.();
		void sendRef.current(autoAsk);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoAsk]);

	const rec = useRecognition({
		onFinal: (t) => {
			if (t.trim()) void sendRef.current(t.trim());
		},
		onInterim: (t) => setInput(t),
		onListening: () => setErr(null),
		onError: () => setErr("Микрофон недоступен — напиши текстом."),
	});

	return (
		<div className={`chat glass ${offline ? "chat-quiet" : ""}`}>
			<div className="chat-head">
				<b>💬 Чат с Колобком</b>
				<span className="chat-status">
					<span
						className={`macro-dot ${
							conn === "online"
								? "st-playing"
								: conn === "offline"
									? "st-offline"
									: ""
						}`}
					/>
					{conn === "online"
						? "на связи"
						: conn === "offline"
							? "режим тишины"
							: "просыпаюсь…"}
				</span>
			</div>

			<AnimatePresence>
				{connecting && (
					<motion.div
						key="wake"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
					>
						<WakeLoader />
					</motion.div>
				)}
			</AnimatePresence>

			<div className="chat-list" ref={listRef}>
				<AnimatePresence initial={false}>
					{msgs.map((m) => (
						<motion.div
							key={m.id}
							className={`msg ${m.role}${m.note ? " msg-note" : ""}`}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.18 }}
						>
							{m.role === "assistant" && (
								<span className="msg-ava" aria-hidden>
									<KolobokFace size={m.note ? 20 : 24} />
								</span>
							)}
							<span className="msg-txt">{m.content}</span>
						</motion.div>
					))}
				</AnimatePresence>
				{busy && (
					<div className="msg assistant typing">
						<span className="msg-ava" aria-hidden>
							<KolobokFace size={24} />
						</span>
						<span className="dots">
							<i />
							<i />
							<i />
						</span>
					</div>
				)}
			</div>

			{err && <div className="chat-err">{err}</div>}

			<div className="chat-quick">
				{QUICK.map((q) => (
					<motion.button
						key={q}
						whileTap={{ scale: 0.94 }}
						disabled={busy || offline}
						onClick={() => void send(q)}
					>
						{q}
					</motion.button>
				))}
			</div>

			<form
				className="chat-row"
				onSubmit={(e) => {
					e.preventDefault();
					void send(input);
				}}
			>
				<button
					type="button"
					className={`chat-mic ${rec.listening ? "on" : ""}`}
					disabled={offline}
					onPointerDown={() => {
						setErr(null);
						rec.start();
					}}
					onPointerUp={() => rec.stop()}
					onPointerLeave={() => rec.listening && rec.stop()}
					title={
						offline
							? "Режим тишины — микрофон отдохнёт, пока связь не вернётся"
							: "Нажми и говори — отправлю, когда отпустишь"
					}
				>
					🎤
				</button>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder={
						offline ? "Режим тишины… напиши чуть позже" : "Спроси Колобка…"
					}
					maxLength={1000}
				/>
				<motion.button
					type="submit"
					className="chat-send"
					whileTap={{ scale: 0.92 }}
					disabled={busy || offline || !input.trim()}
					title={
						offline ? "Связь с волшебным лесом восстанавливается" : "Отправить"
					}
				>
					➤
				</motion.button>
			</form>
		</div>
	);
}
