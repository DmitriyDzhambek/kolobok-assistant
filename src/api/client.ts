/** Общий клиент API бэкенда Колобка (макросы, чат, привычки).
 *
 * Адрес бэкенда:
 *  1. VITE_MACRO_API_URL — если задан явно;
 *  2. в dev-режиме (npm run dev) — относительный /backend-api: Vite проксирует
 *     его на http://127.0.0.1:8765 (работает и на компьютере пользователя,
 *     и в облачном превью, и обходит CORS);
 *  3. в сборке — http://localhost:8765 напрямую (CORS разрешает localhost-порты Vite).
 *
 * Если приложение открыто внутри Telegram Mini App, к каждому запросу
 * добавляется заголовок X-TG-Init-Data — по нему бэкенд проверяет владельца
 * (см. backend/tg_auth.py).
 */

const DEFAULT_BASE = "http://localhost:8765";

/** Хосты Vercel: backend задеплоен тем же проектом (serverless /api/*),
 * поэтому обращаемся по same-origin без префикса. */
export function isVercelHost(): boolean {
	try {
		return /\.vercel\.(app|dev)$/.test(location.hostname);
	} catch {
		return false;
	}
}

export function apiBase(): string {
	const env = (import.meta as any)?.env?.VITE_MACRO_API_URL;
	if (typeof env === "string" && env.trim())
		return env.trim().replace(/\/+$/, "");
	if ((import.meta as any)?.env?.DEV) return "/backend-api";
	if (isVercelHost()) return ""; // same-origin: /api/* и /ws на serverless
	return DEFAULT_BASE;
}

export function tgInitData(): string | null {
	try {
		const d = (window as any)?.Telegram?.WebApp?.initData;
		return typeof d === "string" && d ? d : null;
	} catch {
		return null;
	}
}

export async function apiFetch(
	path: string,
	init?: RequestInit,
	timeoutMs = 20000,
): Promise<any> {
	const headers = new Headers(init?.headers);
	if (init?.body && !headers.has("Content-Type"))
		headers.set("Content-Type", "application/json");
	const td = tgInitData();
	if (td) headers.set("X-TG-Init-Data", td);

	const ctl = new AbortController();
	const to = setTimeout(() => ctl.abort(), timeoutMs);
	try {
		const r = await fetch(apiBase() + path, {
			...init,
			headers,
			signal: ctl.signal,
		});
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

/** «Волшебная» заглушка вместо технических команд: обычные пользователи
 * не должны видеть пути к файлам и инструкции по запуску бэкенда. */
export const BACKEND_HINT =
	"Ой, кажется, я потерял связь с волшебным лесом (сервером). Но ты не расстраивайся! Я уже чиню свои невидимые шестеренки. Попробуй написать мне чуть позже.";

export function friendlyApiError(e: unknown): string {
	if (e instanceof TypeError || (e as any)?.name === "AbortError")
		return BACKEND_HINT;
	return e instanceof Error ? e.message : String(e);
}

export function isNetworkError(e: unknown): boolean {
	return e instanceof TypeError || (e as any)?.name === "AbortError";
}
