import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Прокси к локальному Python-бэкенду Колобка: в dev-режиме фронтенд обращается
// к нему same-origin по пути /backend-api (работает и на компьютере пользователя,
// и в облачном превью, и не требует CORS). Адрес бэкенда можно переопределить
// переменной окружения KOLOBOK_MACRO_BACKEND (по умолчанию 127.0.0.1:8765).
const backendProxy = {
	"/backend-api": {
		target: `http://${process.env.KOLOBOK_MACRO_BACKEND || "127.0.0.1:8765"}`,
		changeOrigin: true,
<<<<<<< HEAD
		ws: true, // «живой канал» /ws для статуса связи и авто-реконнекта
=======
>>>>>>> 1ad8d64 (feat: Колобок v2 — умные мозги как Алиса + Ollama + aider)
		rewrite: (p: string) => p.replace(/^\/backend-api/, ""),
	},
};

export default defineConfig({
	plugins: [react()],
	server: { host: "0.0.0.0", allowedHosts: true, proxy: backendProxy },
	preview: { host: "0.0.0.0", allowedHosts: true, proxy: backendProxy },
});
