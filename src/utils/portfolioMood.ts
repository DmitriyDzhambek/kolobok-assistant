/**
 * Мост «портфель → настроение Колобка».
 *
 * Wealth-блок (вкладка «💰 Wealth») пишет статус портфеля сюда,
 * главный экран читает его и заставляет Колобка улыбаться или грустить.
 *
 * Хранение: sessionStorage (переживает смену вкладки, чистится с сессией)
 * + событие окна, чтобы реакция была мгновенной без перезагрузки.
 */

export type PortfolioStatus = "profit" | "loss" | "neutral";

const STORAGE_KEY = "kolobok-portfolio-status";
export const PORTFOLIO_STATUS_EVENT = "kolobok:portfolio-status";

/** Прочитать последний известный статус (по умолчанию — neutral). */
export function readPortfolioStatus(): PortfolioStatus {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (raw === "profit" || raw === "loss" || raw === "neutral") return raw;
	} catch {
		/* приватный режим / недоступно */
	}
	return "neutral";
}

/** Запомнить статус и разбудить подписчиков. */
export function writePortfolioStatus(status: PortfolioStatus): void {
	try {
		sessionStorage.setItem(STORAGE_KEY, status);
		window.dispatchEvent(new CustomEvent(PORTFOLIO_STATUS_EVENT, { detail: status }));
	} catch {
		/* noop */
	}
}

import { useEffect, useState } from "react";

/** Хук для React: текущий статус портфеля, обновляется на лету. */
export function usePortfolioStatus(): PortfolioStatus {
	const [status, setStatus] = useState<PortfolioStatus>(() => readPortfolioStatus());

	useEffect(() => {
		const onEvent = (e: Event) => {
			const detail = (e as CustomEvent<PortfolioStatus>).detail;
			if (detail === "profit" || detail === "loss" || detail === "neutral") {
				setStatus(detail);
			}
		};
		// При возврате на главный экран читаем сохранённое значение.
		const onVisible = () => setStatus(readPortfolioStatus());

		window.addEventListener(PORTFOLIO_STATUS_EVENT, onEvent);
		window.addEventListener("focus", onVisible);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.removeEventListener(PORTFOLIO_STATUS_EVENT, onEvent);
			window.removeEventListener("focus", onVisible);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, []);

	return status;
}
