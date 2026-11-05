export type TelegramWebApp = {
	initData: string;
	colorScheme?: "light" | "dark";
	ready?: () => void;
	expand?: () => void;
	openLink?: (url: string) => void;
	openTelegramLink?: (url: string) => void;
};

declare global {
	interface Window {
		Telegram?: {
			WebApp?: TelegramWebApp;
		};
	}
}

/** Инициализация Telegram Mini App (если открыты внутри Telegram).
 * Вне Telegram все вызовы безопасны — Колобок работает как обычное веб-приложение.
 */

let inited = false;

export function tgWebApp(): TelegramWebApp | null {
	return typeof window !== "undefined" ? window.Telegram?.WebApp ?? null : null;
}

export function initTma(): void {
	if (inited || typeof window === "undefined") return;
	inited = true;
	const apply = () => {
		const tg = tgWebApp();
		if (tg) {
			tg.ready?.();
			tg.expand?.();
			document.documentElement.dataset.tgTheme = tg.colorScheme || "dark";
		}
	};
	// SDK подключён тегом async: если он ещё не доехал — коротко подождём.
	if (tgWebApp()) {
		apply();
		return;
	}
	let tries = 0;
	const timer = setInterval(() => {
		tries += 1;
		if (tgWebApp() || tries >= 10) {
			clearInterval(timer);
			apply();
		}
	}, 300);
}
