import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, friendlyApiError } from "../api/client";
import { useRecognition } from "../speech/useRecognition";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const WELCOME =
	"Привет! Я — Колобок, сказочный, но очень прокачанный ИИ-ассистент. Помогаю зарабатывать (Telegram Mini Apps, инвестиции, курьерство), вести «Магию утра» и не терять мотивацию. Спроси что-нибудь — текстом или голосом!";

const QUICK = [
	"Как заработать на Mini Apps?",
	"Какую привычку внедрить завтра?",
	"Мотивируй меня!",
];

function uid() {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Чат с «мозгами» Колобка: стеклянные панели, текст + голос, статус связи. */
export function ChatPanel({
	muted,
	speak,
}: {
	muted: boolean;
	speak: (text: string) => void;
}) {
	const [msgs, setMsgs] = useState<Msg[]>([
		{ id: "welcome", role: "assistant", content: WELCOME },
	]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const [online, setOnline] = useState<boolean | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const msgsRef = useRef(msgs);
	msgsRef.current = msgs;

	useEffect(() => {
		let alive = true;
		apiFetch("/api/status", undefined, 2500)
			.then(() => alive && setOnline(true))
			.catch(() => alive && setOnline(false));
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		const el = listRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [msgs, busy]);

	const send = async (text: string) => {
		const t = text.trim();
		if (!t || busy) return;
		setErr(null);
		const user: Msg = { id: uid(), role: "user", content: t };
		const history = [...msgsRef.current, user];
		setMsgs(history);
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
			const reply = String(r?.reply ?? "").trim() || "Колобок задумался и промолчал…";
			setMsgs((p) => [...p, { id: uid(), role: "assistant", content: reply }]);
			setOnline(true);
			if (!muted) speak(reply);
		} catch (e) {
			const m = friendlyApiError(e);
			setErr(m);
			if (e instanceof TypeError) setOnline(false);
			setMsgs((p) => p.filter((x) => x.id !== user.id));
			setInput(t);
		} finally {
			setBusy(false);
		}
	};
	const sendRef = useRef(send);
	sendRef.current = send;

	const rec = useRecognition({
		onFinal: (t) => {
			if (t.trim()) void sendRef.current(t.trim());
		},
		onInterim: (t) => setInput(t),
		onListening: () => setErr(null),
		onError: () => setErr("Микрофон недоступен — напиши текстом."),
	});

	return (
		<div className="chat glass">
			<div className="chat-head">
				<b>💬 Чат с Колобком</b>
				<span className="chat-status">
					<span
						className={`macro-dot ${
							online === null ? "" : online ? "st-playing" : "st-offline"
						}`}
					/>
					{online === null
						? "проверяю связь…"
						: online
							? "на связи"
							: "бэкенд не запущен"}
				</span>
			</div>

			<div className="chat-list" ref={listRef}>
				<AnimatePresence initial={false}>
					{msgs.map((m) => (
						<motion.div
							key={m.id}
							className={`msg ${m.role}`}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.18 }}
						>
							{m.role === "assistant" && (
								<span className="msg-ava" aria-hidden>
									🌟
								</span>
							)}
							<span className="msg-txt">{m.content}</span>
						</motion.div>
					))}
				</AnimatePresence>
				{busy && (
					<div className="msg assistant typing">
						<span className="msg-ava" aria-hidden>
							🌟
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
						disabled={busy}
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
					onPointerDown={() => {
						setErr(null);
						rec.start();
					}}
					onPointerUp={() => rec.stop()}
					onPointerLeave={() => rec.listening && rec.stop()}
					title="Нажми и говори — отправлю, когда отпустишь"
				>
					🎤
				</button>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Спроси Колобка…"
					maxLength={1000}
				/>
				<motion.button
					type="submit"
					className="chat-send"
					whileTap={{ scale: 0.92 }}
					disabled={busy || !input.trim()}
					title="Отправить"
				>
					➤
				</motion.button>
			</form>
		</div>
	);
}
