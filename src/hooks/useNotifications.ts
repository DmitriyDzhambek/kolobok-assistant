/** Система уведомлений от Колобка.
 *
 * Работает через Telegram WebApp API:
 *  - Telegram.WebApp.sendNotification() — отправка push
 *  - Telegram.WebApp.enableClosingConfirmation() — подтверждение закрытия
 *  - localStorage — история уведомлений и настройки
 */

import { useEffect, useState } from "react";

export type Notification = {
	id: string;
	message: string;
	time: number;
	read: boolean;
};

const KEY = "kolobok-notifications";
const MAX_NOTIFS = 50;

/** Сохранить уведомление в localStorage. */
function pushNotif(n: Notification) {
	try {
		const list = JSON.parse(localStorage.getItem(KEY) || "[]") as Notification[];
		list.unshift(n);
		localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_NOTIFS)));
	} catch {
		/* noop */
	}
}

/** Загрузить список уведомлений. */
export function loadNotifications(): Notification[] {
	try {
		return JSON.parse(localStorage.getItem(KEY) || "[]");
	} catch {
		return [];
	}
}

/** Отметить уведомление прочитанным. */
function markRead(id: string) {
	try {
		const list = loadNotifications();
		const n = list.find((x) => x.id === id);
		if (n) n.read = true;
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {
		/* noop */
	}
}

/** Очистить все уведомления. */
export function clearNotifications() {
	localStorage.removeItem(KEY);
}

/** Отправить push-уведомление через Telegram WebApp API.
 * Если вне Telegram — браузерное Notification API. */
export function sendPush(message: string): void {
	// 1. Telegram WebApp API
	try {
		const tg = (window as any)?.Telegram?.WebApp;
		if (tg?.sendNotification) {
			tg.sendNotification(message);
			return;
		}
	} catch {
		/* fall through */
	}

	// 2. Браузерное Notification API
	if ("Notification" in window && Notification.permission === "granted") {
		new Notification("🫓 Колобок", { body: message });
		return;
	}

	// 3. Запросить разрешение
	if ("Notification" in window && Notification.permission !== "denied") {
		Notification.requestPermission().then((perm) => {
			if (perm === "granted") {
				new Notification("🫓 Колобок", { body: message });
			}
		});
		return;
	}

	// 4. Fallback — Alert (только для отладки)
	// alert(message);
}

/** Спросить разрешение на уведомления. */
export function requestNotificationPermission(): Promise<boolean> {
	return new Promise((resolve) => {
		if (!("Notification" in window)) {
			resolve(false);
			return;
		}
		if (Notification.permission === "granted") {
			resolve(true);
			return;
		}
		if (Notification.permission === "denied") {
			resolve(false);
			return;
		}
		Notification.requestPermission().then((perm) => resolve(perm === "granted"));
	});
}

/** Hook для колобка-уведомлений. */
export function useNotifications() {
	const [notifs, setNotifs] = useState<Notification[]>(loadNotifications);

	// Подписка на localStorage-события (другие вкладки).
	useEffect(() => {
		const handler = () => setNotifs(loadNotifications());
		window.addEventListener("storage", handler);
		return () => window.removeEventListener("storage", handler);
	}, []);

	const addNotif = (message: string) => {
		const n: Notification = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			message,
			time: Date.now(),
			read: false,
		};
		pushNotif(n);
		setNotifs(loadNotifications);
		sendPush(message);
	};

	const markAsRead = (id: string) => {
		markRead(id);
		setNotifs(loadNotifications);
	};

	const dismiss = (id: string) => {
		try {
			const list = loadNotifications().filter((x) => x.id !== id);
			localStorage.setItem(KEY, JSON.stringify(list));
			setNotifs(list);
		} catch {
			/* noop */
		}
	};

	const dismissAll = () => {
		clearNotifications();
		setNotifs([]);
	};

	return {
		notifs,
		addNotif,
		markAsRead,
		dismiss,
		dismissAll,
	};
}
