/** Хук проверки обновлений Service Worker (для PWA).
 *
 * Когда пользователь установил приложение на рабочий стол,
 * браузер кэширует файлы. Этот хук обнаруживает новую версию
 * и показывает баннер для перезагрузки.
 */

import { useEffect, useState } from "react";

export function useSWUpdate() {
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

	useEffect(() => {
		// В dev-режиме SW не регистрируем — иначе Vite-файлы залипают в кэше.
		if (import.meta.env.DEV) return;
		if (!("serviceWorker" in navigator)) return;

		const onControllerChange = () => window.location.reload();
		navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

		navigator.serviceWorker
			// Относительный путь + scope — SW работает и в корне, и в подпапке
			// (Vercel-домен, localhost, Telegram Mini App — все варианты).
			.register("sw.js", { scope: "./" })
			.then((reg) => {
				if (reg.waiting) {
					setUpdateAvailable(true);
					setWaitingWorker(reg.waiting);
				}

			reg.addEventListener("updatefound", () => {
				const newWorker = reg.installing;
				if (!newWorker) return;

				newWorker.addEventListener("statechange", () => {
					// Показываем баннер только если приложением уже управлял старый SW
					// (то есть это обновление, а не первая установка).
					if (
						newWorker.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						setUpdateAvailable(true);
						setWaitingWorker(newWorker);
					}
				});
			});
			})
			.catch(() => {
				/* SW не зарегистрирован — обычный режим */
			});

		return () => {
			navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
		};
	}, []);

	const installUpdate = () => {
		if (waitingWorker) {
			waitingWorker.postMessage("SKIP_WAITING");
			setUpdateAvailable(false);
			setWaitingWorker(null);
		}
	};

	// Периодическая проверка обновлений: Chrome сам проверяет sw.js только
	// при навигации и раз в сутки. Для постоянно открытого PWA на рабочем
	// столе спрашиваем обновление сами — каждые 60 секунд.
	useEffect(() => {
		if (import.meta.env.DEV) return;
		if (!("serviceWorker" in navigator)) return;
		const iv = setInterval(() => {
			navigator.serviceWorker.getRegistration().then((reg) => {
				if (reg) reg.update().catch(() => {});
			});
		}, 60_000);
		return () => clearInterval(iv);
	}, []);

	return { updateAvailable, installUpdate };
}
