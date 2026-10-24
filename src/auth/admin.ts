/** Права доступа к админ-панели.
 *
 * Вход: Telegram WebApp → initData → user.id
 * Твой Telegram ID узнай через @userinfobot
 */

import { useEffect, useState } from "react";

/** ⬇️ ВПИШИ СЮДА СВОЙ TELEGRAM ID (узнать: @userinfobot) ⬇️ */
const ADMIN_TG_IDS: string[] = [
	// "123456789",  ← раскомментируй и впиши свой числовой ID
];

export type TgUser = {
	id: number;
	first_name?: string;
	username?: string;
	phone?: string;
};

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
		return {
			id,
			first_name: user?.first_name,
			username: user?.username,
			phone: user?.phone_number,
		};
	} catch {
		return null;
	}
}

/** Есть ли у текущего пользователя права администратора. */
export function isAdmin(): boolean {
	const user = getTgUser();
	if (!user) return false;
	return ADMIN_TG_IDS.includes(String(user.id));
}

/** Реактивная версия проверки — обновляется при смене initData/URL. */
export function useAdminAuth(): { isAdmin: boolean; user: TgUser | null } {
	const [state, setState] = useState(() => ({
		isAdmin: isAdmin(),
		user: getTgUser(),
	}));

	useEffect(() => {
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
