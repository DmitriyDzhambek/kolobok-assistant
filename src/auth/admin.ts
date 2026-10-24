/** Права доступа к админ-панели.
 *
 * ⚠️ ВАЖНО про безопасность
 * Это клиентская (UI) проверка: она прячет вкладку и панель от обычных
 * пользователей. Полностью защитить данные она не может — любой код в
 * браузере можно прочитать. Настоящая защита — на бэкенде: Telegram
 * подписывает initData секретом бота, и сервер проверяет подпись и ID
 * (см. backend/tg_auth.py + переменные KOLOBOK_TG_BOT_TOKEN и
 * KOLOBOK_ALLOWED_TG_IDS). Для управления партнёрами через API эти проверки
 * обязательны.
 *
 * Два способа получить права:
 *
 *  1. Telegram ID (основной, работает внутри Telegram Mini App):
 *     впиши свой ID в ADMIN_TG_IDS ниже или задай VITE_ADMIN_TG_IDS=123456789
 *     в .env. Свой ID узнать: напиши боту @userinfobot — он покажет числовой ID.
 *
 *  2. Секретный URL-параметр (для входа с рабочего стола / из браузера):
 *     https://твой-сайт/?kolobok-admin=СЕКРЕТ
 *     Секрет: VITE_ADMIN_SECRET в .env (по умолчанию "kolobok-2026" —
 *     обязательно смени на свой!).
 */

import { useEffect, useState } from "react";

/** ⬇️⬇️⬇️ ВПИШИ СЮДА СВОЙ TELEGRAM ID (узнать: @userinfobot) ⬇️⬇️⬇️ */
const HARDCODED_ADMIN_IDS: string[] = [
	// "123456789",  ← раскомментируй и впиши свой ID
];

/** Секрет для входа по ссылке: ?kolobok-admin=<секрет> */
const DEFAULT_ADMIN_SECRET = "kolobok-2026";

const ADMIN_PARAM = "kolobok-admin";

export type TgUser = {
	id: number;
	first_name?: string;
	username?: string;
};

/** Список разрешённых Telegram ID: хардкод + VITE_ADMIN_TG_IDS. */
export function adminIds(): string[] {
	const env = (import.meta as any)?.env?.VITE_ADMIN_TG_IDS;
	const fromEnv = typeof env === "string" ? env.split(/[,;\s]+/) : [];
	return [...HARDCODED_ADMIN_IDS, ...fromEnv]
		.map((s) => String(s).trim())
		.filter(Boolean);
}

/** Пользователь из initData Telegram (или null, если вне Telegram). */
export function getTgUser(): TgUser | null {
	try {
		const initData = (window as any)?.Telegram?.WebApp?.initData;
		if (typeof initData !== "string" || !initData) return null;
		const raw = new URLSearchParams(initData).get("user");
		if (!raw) return null;
		const user = JSON.parse(raw);
		const id = Number(user?.id ?? 0);
		if (!id) return null;
		return { id, first_name: user?.first_name, username: user?.username };
	} catch {
		return null;
	}
}

/** Открыт ли секретный параметр доступа. */
export function hasAdminSecret(): boolean {
	try {
		const secret =
			((import.meta as any)?.env?.VITE_ADMIN_SECRET as string) ||
			DEFAULT_ADMIN_SECRET;
		const given = new URLSearchParams(window.location.search).get(ADMIN_PARAM);
		return !!given && given === secret;
	} catch {
		return false;
	}
}

/** Есть ли у текущего пользователя права администратора. */
export function isAdmin(): boolean {
	if (hasAdminSecret()) return true;
	const user = getTgUser();
	if (!user) return false;
	return adminIds().includes(String(user.id));
}

/** Реактивная версия проверки — обновляется при смене initData/URL. */
export function useAdminAuth(): { isAdmin: boolean; user: TgUser | null } {
	const [state, setState] = useState(() => ({
		isAdmin: isAdmin(),
		user: getTgUser(),
	}));

	useEffect(() => {
		// Telegram WebApp инициализируется асинхронно — перепроверяем
		// несколько раз, пока SDK не подтянет initData.
		let tries = 0;
		const timer = setInterval(() => {
			tries += 1;
			const user = getTgUser();
			if (user || tries > 12) {
				clearInterval(timer);
				setState({ isAdmin: isAdmin(), user });
			}
		}, 400);
		return () => clearInterval(timer);
	}, []);

	return state;
}
