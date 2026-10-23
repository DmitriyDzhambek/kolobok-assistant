import { useEffect, useRef, useState } from "react";
import { apiFetch, friendlyApiError } from "../api/client";

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
				const s = await apiFetch("/api/status", undefined, 2500);
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
					await apiFetch("/api/record", { method: "POST" }, 4000);
					setLastError(null);
					return null;
				} catch (e) {
					const msg = friendlyApiError(e);
					setLastError(msg);
					return msg;
				}
			},
			play: async (repeat: number) => {
				try {
					await apiFetch(
						"/api/play",
						{
							method: "POST",
							body: JSON.stringify({ repeat_count: repeat }),
						},
						4000,
					);
					setLastError(null);
					return null;
				} catch (e) {
					const msg = friendlyApiError(e);
					setLastError(msg);
					return msg;
				}
			},
			stop: async () => {
				try {
					await apiFetch("/api/stop", { method: "POST" }, 4000);
					setLastError(null);
					return null;
				} catch (e) {
					const msg = friendlyApiError(e);
					setLastError(msg);
					return msg;
				}
			},
		};
	}

	return { status, lastError, ctl: ctlRef.current };
}
