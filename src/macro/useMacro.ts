import { useEffect, useRef, useState } from "react";

/** Состояния макрос-бэкенда (Python FastAPI, backend/macro_server.py). */
export type MacroState =
	| "offline"
	| "idle"
	| "recording"
	| "stopping"
	| "playing";

export type MacroMeta = {
	events: number;
	duration_ms: number;
	created?: string | null;
	screen?: { w: number; h: number } | null;
};

export type MacroStatus = {
	state: MacroState;
	macro: MacroMeta | null;
	error?: string | null;
};

/** Управляющий объект, который передаётся в движок голосовых команд (Ctx.macro). */
export type MacroCtl = {
	state: () => string;
	toggleRecord: () => Promise<string | null>;
	play: (repeat: number) => Promise<string | null>;
	stop: () => Promise<string | null>;
};

const DEFAULT_BASE = "http://localhost:8765";

function apiBase(): string {
	const env = (import.meta as any)?.env?.VITE_MACRO_API_URL;
	return typeof env === "string" && env.trim()
		? env.trim().replace(/\/+$/, "")
		: DEFAULT_BASE;
}

async function req(path: string, init?: RequestInit): Promise<any> {
	const ctl = new AbortController();
	const to = setTimeout(() => ctl.abort(), 2500);
	try {
		const r = await fetch(apiBase() + path, { ...init, signal: ctl.signal });
		if (!r.ok) {
			let detail = "HTTP " + r.status;
			try {
				const j = await r.json();
				if (j?.detail) detail = String(j.detail);
			} catch {
				/* тело не JSON — оставим статус */
			}
			throw new Error(detail);
		}
		return await r.json();
	} finally {
		clearTimeout(to);
	}
}

const OFFLINE_MSG =
	"Бэкенд макросов не отвечает. Запустите на компьютере backend\\start_backend.bat (или: python backend/macro_server.py).";

function friendly(e: unknown): string {
	if (e instanceof TypeError || (e as any)?.name === "AbortError")
		return OFFLINE_MSG;
	return e instanceof Error ? e.message : String(e);
}

export function useMacro() {
	const [status, setStatus] = useState<MacroStatus>({
		state: "offline",
		macro: null,
	});
	const [lastError, setLastError] = useState<string | null>(null);
	const statusRef = useRef(status);
	statusRef.current = status;

	useEffect(() => {
		let alive = true;
		const tick = async () => {
			try {
				const s = await req("/api/status");
				if (!alive) return;
				setStatus({
					state: (s.state as MacroState) ?? "idle",
					macro: s.macro ?? null,
					error: s.error ?? null,
				});
				setLastError(null);
			} catch {
				if (alive)
					setStatus((p) =>
						p.state === "offline" ? p : { state: "offline", macro: p.macro },
					);
			}
		};
		void tick();
		const iv = setInterval(tick, 1200);
		return () => {
			alive = false;
			clearInterval(iv);
		};
	}, []);

	const ctlRef = useRef<MacroCtl | null>(null);
	if (!ctlRef.current) {
		ctlRef.current = {
			state: () => statusRef.current.state,
			toggleRecord: async () => {
				try {
					await req("/api/record", { method: "POST" });
					setLastError(null);
					return null;
				} catch (e) {
					const msg = friendly(e);
					setLastError(msg);
					return msg;
				}
			},
			play: async (repeat: number) => {
				try {
					await req("/api/play", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ repeat_count: repeat }),
					});
					setLastError(null);
					return null;
				} catch (e) {
					const msg = friendly(e);
					setLastError(msg);
					return msg;
				}
			},
			stop: async () => {
				try {
					await req("/api/stop", { method: "POST" });
					setLastError(null);
					return null;
				} catch (e) {
					const msg = friendly(e);
					setLastError(msg);
					return msg;
				}
			},
		};
	}

	return { status, lastError, ctl: ctlRef.current };
}
