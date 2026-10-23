import { useSyncExternalStore } from "react";
import { apiFetch, isVercelHost } from "../api/client";

/** Состояние связи с бэкендом Колобка:
 *  - "connecting" — первая попытка ещё не завершилась («просыпаюсь…»);
 *  - "online"     — живой канал /ws открыт (или HTTP-пинг прошёл);
 *  - "offline"    — связи нет, включаем «режим тишины» и пробуем снова каждые 5 с.
 *
 * Один WebSocket на всё приложение (singleton): подписчики получают состояние
 * через useSyncExternalStore. При обрыве связи менеджер сам переподключается
 * каждые 5 секунд; как только бэкенд ожил — состояние возвращается в "online"
 * и компоненты это видят без перезагрузки страницы.
 */
export type ConnState = "connecting" | "online" | "offline";

const RETRY_MS = 5000; // фоновое переподключение в режиме тишины
const QUIET_WS_RETRY_MS = 15000; // WS уже заблокирован, но HTTP жив — пробуем реже
const WS_TIMEOUT_MS = 4000;
const KEEPALIVE_MS = 20000;

class ConnectionManager {
	private state: ConnState = "connecting";
	private resolvedOnce = false;
	private ws: WebSocket | null = null;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private keepAlive: ReturnType<typeof setInterval> | null = null;
	private listeners = new Set<() => void>();
	private started = false;

	getState = (): ConnState => this.state;
	/** Для SSR: до гидрации считаем, что ещё подключаемся. */
	getServerState = (): ConnState => "connecting";

	subscribe = (cb: () => void): (() => void) => {
		this.listeners.add(cb);
		this.start();
		return () => {
			this.listeners.delete(cb);
		};
	};

	private set(next: ConnState) {
		if (this.state === next) return;
		this.state = next;
		this.listeners.forEach((l) => l());
	}

	start() {
		if (this.started) return;
		this.started = true;
		if (typeof window === "undefined") return;
		window.addEventListener("online", () => this.attempt());
		this.attempt();
	}

	private wsUrl(): string {
		const env = (import.meta as any)?.env?.VITE_MACRO_API_URL;
		if (typeof env === "string" && env.trim())
			return env.trim().replace(/\/+$/, "").replace(/^http/, "ws") + "/ws";
		if ((import.meta as any)?.env?.DEV && typeof location !== "undefined") {
			const proto = location.protocol === "https:" ? "wss:" : "ws:";
			return `${proto}//${location.host}/backend-api/ws`;
		}
		if (typeof location !== "undefined" && isVercelHost()) {
			// Vercel: serverless не держит WebSocket — соединение упадёт,
			// менеджер сам откатится на HTTP-пинг /api/status (same-origin).
			const proto = location.protocol === "https:" ? "wss:" : "ws:";
			return `${proto}//${location.host}/ws`;
		}
		return "ws://localhost:8765/ws";
	}

	private closeWs() {
		const ws = this.ws;
		this.ws = null;
		if (ws) {
			ws.onopen = ws.onerror = ws.onclose = ws.onmessage = null;
			try {
				ws.close();
			} catch {
				/* noop */
			}
		}
	}

	private scheduleRetry() {
		if (this.retryTimer) return;
		const delay = this.state === "online" ? QUIET_WS_RETRY_MS : RETRY_MS;
		this.retryTimer = setTimeout(() => {
			this.retryTimer = null;
			this.attempt();
		}, delay);
	}

	private async httpPing(): Promise<boolean> {
		try {
			await apiFetch("/api/status", undefined, 2500);
			return true;
		} catch {
			return false;
		}
	}

	private attempt() {
		if (typeof window === "undefined") return;
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
		if (!this.resolvedOnce) this.set("connecting");
		this.closeWs();

		let settled = false;
		const fail = () => {
			if (settled) return;
			settled = true;
			this.closeWs();
			// WS мог быть заблокирован прокси — проверяем бэкенд обычным пингом.
			void this.httpPing().then((alive) => {
				this.resolvedOnce = true;
				this.set(alive ? "online" : "offline");
				this.startKeepAlive();
				this.scheduleRetry();
			});
		};

		try {
			if (typeof WebSocket === "undefined") throw new Error("no WebSocket");
			const ws = new WebSocket(this.wsUrl());
			this.ws = ws;
			const to = setTimeout(fail, WS_TIMEOUT_MS);
			ws.onopen = () => {
				clearTimeout(to);
				if (settled) return;
				settled = true;
				this.resolvedOnce = true;
				this.set("online");
				this.startKeepAlive();
			};
			ws.onerror = () => {
				clearTimeout(to);
				fail();
			};
			ws.onclose = () => {
				clearTimeout(to);
				if (!settled) {
					fail();
					return;
				}
				// Живой канал оборвался: честно уходим в режим тишины и чинимся.
				if (this.ws === ws && this.state === "online") {
					this.set("offline");
					this.scheduleRetry();
				}
			};
		} catch {
			fail();
		}
	}

	private startKeepAlive() {
		this.stopKeepAlive();
		this.keepAlive = setInterval(() => {
			const ws = this.ws;
			if (ws && ws.readyState === WebSocket.OPEN) {
				try {
					ws.send("ping");
				} catch {
					/* noop */
				}
			} else if (this.state === "offline") {
				// HTTP-пинг тоже часть попытки: attempt() восстановит всё разом.
				this.attempt();
			}
		}, KEEPALIVE_MS);
	}

	private stopKeepAlive() {
		if (this.keepAlive) {
			clearInterval(this.keepAlive);
			this.keepAlive = null;
		}
	}
}

export const connection = new ConnectionManager();

/** React-хук: isConnecting / isConnected / isOffline одним значением. */
export function useConnection(): ConnState {
	return useSyncExternalStore(
		connection.subscribe,
		connection.getState,
		connection.getServerState,
	);
}
