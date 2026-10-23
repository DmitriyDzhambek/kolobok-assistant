"""Serverless-вход Колобка на Vercel.

Файл лежит в api/ — Vercel автоматически собирает его как Python-функцию
(@vercel/python). Экспортируемый ASGI-объект `app` Vercel использует как
обработчик: весь FastAPI backend (backend/macro_server.py) работает без
изменений. Маршрутизация настроена в vercel.json: /api/* и /ws уходят сюда,
остальное отдаёт статический фронтенд Vite из dist/.

Ограничения serverless-среды (учтены):
  * нет WebSocket — фронтенд сам откатывается на HTTP-пинг /api/status;
  * файловая система только для чтения — хранилища db.py/chat_store.py
    сами падают в /tmp (см. backend/storage_paths.py);
  * нет экрана и мыши — запись/воспроизведение макросов (pynput/pyautogui)
    доступны только в локальном backend на компьютере пользователя
    (backend/start_backend.bat), сюда эти библиотеки не ставятся.
"""

import os
import sys

# backend/ использует плоские импорты (import db, import llm) — добавляем
# папку backend в sys.path до импорта пакета, как это делает локальный запуск.
sys.path.insert(
	0,
	os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"),
)

from backend.macro_server import app  # noqa: E402  (ASGI-приложение FastAPI)

__all__ = ["app"]
