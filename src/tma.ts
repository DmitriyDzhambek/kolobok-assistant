/** Инициализация Telegram Mini App (если открыты внутри Telegram).
 * Вне Telegram все вызовы безопасны — Колобок работает как обычное веб-приложение.
 */

let inited = false;

export function tgWebApp(): any | null {
	try {
		return (
			(typeof window !== "undefined" && (window as any)?.Telegram?.WebApp) ||
			null
		);
	} catch {
		return null;
	}
}

export function initTma(): void {
	if (inited || typeof window === "undefined") return;
	inited = true;
	try {
		const tg = tgWebApp();
		if (tg) {
			tg.ready?.();
			tg.expand?.();
			// Подсказка браузеру Telegram о тёмной теме приложения.
			try {
				document.documentElement.dataset.tgTheme = tg.colorScheme || "dark";
			} catch {
				/* noop */
			}
		}
	} catch {
		/* не в Telegram — обычный режим */
	}
}
