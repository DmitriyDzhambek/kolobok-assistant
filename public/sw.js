const CACHE = "kolobok-v3";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

function cachePut(cacheName, req, res) {
	if (!res || !res.ok || res.type !== "basic") return;
	const copy = res.clone();
	caches
		.open(cacheName)
		.then((c) => c.put(req, copy))
		.catch(() => {});
}

self.addEventListener("install", (e) => {
	e.waitUntil(
		caches
			.open(CACHE)
			.then((c) =>
				Promise.allSettled(CORE.map((url) => c.add(url).catch(() => {}))),
			)
			.then(() => {
				// Новый SW установлен, но не активировался — ждём, пока все вкладки закроются.
				// Когда пользователь откроет приложение снова — активируется сразу.
			})
			.catch(() => {}),
	);
});

self.addEventListener("activate", (e) => {
	e.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (e) => {
	const req = e.request;
	if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

	// Навигация: всегда сначала сеть (свежий index.html), кэш — офлайн-fallback.
	if (req.mode === "navigate") {
		e.respondWith(
			fetch(req)
				.then((res) => {
					cachePut(CACHE, req, res);
					return res;
				})
				.catch(() =>
					caches.match(req).then((hit) => hit || caches.match("./index.html")),
				),
		);
		return;
	}

	// Статика: кэш-первый с авто-пополнением.
	e.respondWith(
		caches.match(req).then(
			(hit) =>
				hit ||
				fetch(req)
					.then((res) => {
						cachePut(CACHE, req, res);
						return res;
					})
					.catch(() => Response.error()),
		),
	);
});

// Сообщаем клиентам, что есть новая версия.
self.addEventListener("message", (event) => {
	if (event.data === "SKIP_WAITING") {
		self.skipWaiting();
	}
	if (event.data === "clearCache") {
		caches.keys().then((keys) => {
			Promise.all(keys.map((k) => caches.delete(k)));
		});
	}
});

// Автоматически уведомляем клиентов о новой версии.
self.addEventListener("activate", () => {
	self.clients.matchAll({ type: "window" }).then((clients) => {
		clients.forEach((client) => {
			client.postMessage({ type: "SW_UPDATE_AVAILABLE" });
		});
	});
});
