const CACHE = "kolobok-v2";
<<<<<<< HEAD
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];
=======
const CORE = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];
>>>>>>> 1ad8d64 (feat: Колобок v2 — умные мозги как Алиса + Ollama + aider)

function cachePut(cacheName, req, res) {
	// Кэшируем только успешные same-origin ответы: ошибки (403/404/заглушки)
	// никогда не должны попадать в кэш и «залипать» там.
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
			.then(() => self.skipWaiting())
			.catch(() => self.skipWaiting()),
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

	// Навигация: сначала сеть, кэш только как офлайн-fallback.
	if (req.mode === "navigate") {
		e.respondWith(
			fetch(req)
				.then((res) => {
					cachePut(CACHE, req, res);
					return res;
				})
				.catch(() =>
<<<<<<< HEAD
					caches.match(req).then((hit) => hit || caches.match("./index.html")),
=======
					caches.match(req).then((hit) => hit || caches.match("/index.html")),
>>>>>>> 1ad8d64 (feat: Колобок v2 — умные мозги как Алиса + Ollama + aider)
				),
		);
		return;
	}

	// Остальные same-origin GET: кэш-первый с пополнением только успешными ответами.
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
