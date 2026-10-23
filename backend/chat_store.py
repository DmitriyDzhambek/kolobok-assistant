r"""Профили пользователей и история чата — «память» диалога Колобка.

ВАЖНО (правило платформы): SQLite в пользовательских проектах запрещён,
поэтому вместо kolobok.db (SQLite+SQLAlchemy) используется та же схема, но:

  * production: PostgreSQL через переменную окружения
        DATABASE_URL=postgresql://user:pass@host:5432/kolobok
    (драйвер psycopg — ленивый импорт; pip install "psycopg[binary]");
  * локально без DATABASE_URL: постоянный файл backend/data/chat.json
    (путь — KOLOBOK_CHAT_FILE). Данные сохраняются между запусками.

Схема (одинакова для PostgreSQL и JSON):

  users
    id           TEXT PRIMARY KEY       -- 'tg:<telegram_id>' или 'local'
    telegram_id  BIGINT UNIQUE NULL     -- из проверенного initData (tg_auth.py)
    username     TEXT NULL
    created_at   TIMESTAMPTZ DEFAULT now()

  chat_history
    id           BIGSERIAL PRIMARY KEY  -- в JSON: возрастающий int
    user_id      TEXT → users.id (ON DELETE CASCADE)
    role         TEXT 'user' | 'assistant'
    content      TEXT NOT NULL
    created_at   TIMESTAMPTZ DEFAULT now()

Память диалога: recent_messages(user_id, limit) возвращает последние N
сообщений конкретного пользователя (старые → новые). История разных
пользователей никогда не смешивается: ключ — user_id из initData Telegram,
а для локального режима — отдельный профиль 'local'.
"""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent

PG_DDL = """
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    username    TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_history (
    id         BIGSERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history (user_id, id);
"""

MAX_CONTENT = 4000


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def user_key(tg_user: Optional[Dict[str, Any]]) -> str:
    """Ключ профиля: из проверенного initData или 'local' для домашнего режима."""
    if tg_user and tg_user.get("id"):
        return f"tg:{int(tg_user['id'])}"
    return "local"


class JsonChatRepo:
    """Локальное постоянное хранилище (файл JSON, без СУБД)."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = threading.RLock()

    def _load(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {"users": {}, "messages": [], "seq": 0}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            data.setdefault("users", {})
            data.setdefault("messages", [])
            data.setdefault("seq", len(data["messages"]))
            return data
        except Exception:
            return {"users": {}, "messages": [], "seq": 0}

    def _save(self, data: Dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.path)

    def ensure_user(self, key: str, tg_user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        with self.lock:
            data = self._load()
            u = data["users"].get(key)
            if u is None:
                u = {
                    "id": key,
                    "telegram_id": (tg_user or {}).get("id"),
                    "username": (tg_user or {}).get("username"),
                    "created_at": _now_iso(),
                }
                data["users"][key] = u
                self._save(data)
            return u

    def append_message(self, key: str, role: str, content: str) -> Optional[Dict[str, Any]]:
        content = str(content)[:MAX_CONTENT]
        if not content.strip() or role not in ("user", "assistant"):
            return None
        with self.lock:
            data = self._load()
            msgs = [m for m in data["messages"] if m.get("user_id") == key]
            # дедупликация только пользовательских сообщений: клиент шлёт всю
            # историю — не сохранять повтор; ответы Колобка сохраняем всегда
            if role == "user":
                for m in reversed(msgs):
                    if m["role"] == role:
                        if m["content"] == content:
                            return None
                        break
            data["seq"] = int(data.get("seq", 0)) + 1
            msg = {
                "id": data["seq"],
                "user_id": key,
                "role": role,
                "content": content,
                "created_at": _now_iso(),
            }
            data["messages"].append(msg)
            # не раздуваем файл бесконечно: последние 500 сообщений на профиль
            keep = [m for m in data["messages"] if m.get("user_id") != key] + \
                   [m for m in data["messages"] if m.get("user_id") == key][-500:]
            data["messages"] = sorted(keep, key=lambda m: m["id"])
            self._save(data)
            return msg

    def recent_messages(self, key: str, limit: int = 10) -> List[Dict[str, Any]]:
        with self.lock:
            data = self._load()
            msgs = [m for m in data["messages"] if m.get("user_id") == key]
            return [
                {"role": m["role"], "content": m["content"], "created_at": m["created_at"]}
                for m in msgs[-max(1, min(50, limit)):]
            ]


class PgChatRepo:
    """Production-хранилище: PostgreSQL через DATABASE_URL (psycopg 3)."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.lock = threading.RLock()

    def _conn(self):
        import psycopg  # ленивый импорт: pip install "psycopg[binary]"

        return psycopg.connect(self.dsn, autocommit=False)

    def _ensure(self, conn) -> None:
        with conn.cursor() as cur:
            cur.execute(PG_DDL)
        conn.commit()

    def ensure_user(self, key: str, tg_user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        tg_id = (tg_user or {}).get("id")
        username = (tg_user or {}).get("username")
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO users (id, telegram_id, username)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (id) DO UPDATE
                       SET username = COALESCE(EXCLUDED.username, users.username)""",
                    (key, tg_id, username),
                )
                cur.execute(
                    "SELECT id, telegram_id, username, created_at FROM users WHERE id = %s",
                    (key,),
                )
                r = cur.fetchone()
            conn.commit()
        if r is None:  # pragma: no cover - INSERT ... ON CONFLICT гарантирует строку
            raise RuntimeError(f"user {key} vanished right after upsert")
        return {
            "id": r[0],
            "telegram_id": r[1],
            "username": r[2],
            "created_at": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3]),
        }

    def append_message(self, key: str, role: str, content: str) -> Optional[Dict[str, Any]]:
        content = str(content)[:MAX_CONTENT]
        if not content.strip() or role not in ("user", "assistant"):
            return None
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            with conn.cursor() as cur:
                if role == "user":
                    cur.execute(
                        """SELECT content FROM chat_history
                           WHERE user_id = %s AND role = 'user' ORDER BY id DESC LIMIT 1""",
                        (key,),
                    )
                    last = cur.fetchone()
                    if last and last[0] == content:
                        conn.commit()
                        return None
                cur.execute(
                    """INSERT INTO chat_history (user_id, role, content)
                       VALUES (%s, %s, %s) RETURNING id, created_at""",
                    (key, role, content),
                )
                r = cur.fetchone()
            conn.commit()
        if r is None:  # pragma: no cover - RETURNING всегда отдаёт строку
            raise RuntimeError("chat_history INSERT returned no row")
        return {
            "id": r[0],
            "user_id": key,
            "role": role,
            "content": content,
            "created_at": r[1].isoformat() if hasattr(r[1], "isoformat") else str(r[1]),
        }

    def recent_messages(self, key: str, limit: int = 10) -> List[Dict[str, Any]]:
        limit = max(1, min(50, limit))
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT role, content, created_at FROM chat_history
                       WHERE user_id = %s ORDER BY id DESC LIMIT %s""",
                    (key, limit),
                )
                rows = cur.fetchall()
            conn.commit()
        rows.reverse()
        return [
            {
                "role": r[0],
                "content": r[1],
                "created_at": r[2].isoformat() if hasattr(r[2], "isoformat") else str(r[2]),
            }
            for r in rows
        ]


_repo: Optional[Any] = None
_repo_lock = threading.Lock()


def get_chat_repo():
    """Singleton: PostgreSQL при DATABASE_URL, иначе JSON-файл."""
    global _repo
    with _repo_lock:
        if _repo is None:
            dsn = os.environ.get("DATABASE_URL", "").strip()
            if dsn:
                _repo = PgChatRepo(dsn)
            else:
                path = Path(
                    os.environ.get("KOLOBOK_CHAT_FILE")
                    or (BASE_DIR / "data" / "chat.json")
                )
                _repo = JsonChatRepo(path)
        return _repo


def reset_chat_repo() -> None:
    """Для тестов: сбросить singleton."""
    global _repo
    with _repo_lock:
        _repo = None


def remember_user(tg_user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Создать/обновить профиль и вернуть его (users)."""
    key = user_key(tg_user)
    return get_chat_repo().ensure_user(key, tg_user)


def remember_message(tg_user: Optional[Dict[str, Any]], role: str, content: str) -> None:
    key = user_key(tg_user)
    get_chat_repo().append_message(key, role, content)


def memory_for(tg_user: Optional[Dict[str, Any]], limit: int = 10) -> List[Dict[str, str]]:
    """Последние N сообщений профиля для контекста LLM (старые → новые)."""
    key = user_key(tg_user)
    return [
        {"role": m["role"], "content": m["content"]}
        for m in get_chat_repo().recent_messages(key, limit)
    ]


def _touch_keepalive() -> float:
    return time.time()
