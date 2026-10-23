r"""Хранилище привычек и утренних ритуалов — модуль «Магия утра».

ВАЖНО (правило платформы): SQLite в пользовательских проектах запрещён.
Поэтому схема спроектирована под внешнюю production-базу, а для локального
запуска используется постоянный JSON-файл (данные сохраняются между сессиями):

  * production: PostgreSQL через переменную окружения
        DATABASE_URL=postgresql://user:pass@host:5432/kolobok
    (драйвер psycopg — ленивый импорт; pip install "psycopg[binary]");
  * локально без DATABASE_URL: файл backend/data/habits.json
    (путь можно задать переменной KOLOBOK_HABITS_FILE).

Схема данных (одинакова для PostgreSQL и JSON):

  habits
    id          TEXT PRIMARY KEY        -- uuid
    title       TEXT NOT NULL           -- «Выпить стакан воды»
    icon        TEXT DEFAULT '⭐'       -- эмодзи кристалла/созвездия
    created_at  TEXT (ISO 8601)         -- в PG: TIMESTAMPTZ DEFAULT now()
    sort_order  INTEGER DEFAULT 0
    archived    BOOLEAN DEFAULT FALSE
    best_streak INTEGER DEFAULT 0       -- рекордная цепочка дней

  habit_logs
    habit_id    TEXT  → habits.id (ON DELETE CASCADE)
    day         TEXT 'YYYY-MM-DD'       -- в PG: DATE
    status      TEXT 'done' | 'skipped'
    marked_at   TEXT (ISO 8601)
    PRIMARY KEY (habit_id, day)         -- одна отметка на привычку в день

Стрик (цепочка) отдельной таблицей не хранится — вычисляется из habit_logs:
количество подряд идущих дней со статусом 'done', заканчивающихся сегодня
или вчера (сегодняшняя отметка может быть ещё не сделана).
"""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent

PG_DDL = """
CREATE TABLE IF NOT EXISTS habits (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    icon        TEXT DEFAULT '⭐',
    created_at  TIMESTAMPTZ DEFAULT now(),
    sort_order  INTEGER DEFAULT 0,
    archived    BOOLEAN DEFAULT FALSE,
    best_streak INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS habit_logs (
    habit_id  TEXT REFERENCES habits(id) ON DELETE CASCADE,
    day       DATE NOT NULL,
    status    TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
    marked_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (habit_id, day)
);
"""


def today_str() -> str:
    return date.today().isoformat()


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def compute_streak(logmap: Dict[str, str], today: Optional[date] = None) -> Dict[str, Any]:
    """logmap: {'YYYY-MM-DD': 'done'|'skipped'} → current/best/week[7]."""
    today = today or date.today()
    day_map = dict(logmap)

    # Текущая цепочка: идём назад от сегодня (или от вчера, если сегодня ещё не отмечено).
    d = today
    if day_map.get(d.isoformat()) != "done":
        d = today - timedelta(days=1)
    current = 0
    while day_map.get(d.isoformat()) == "done":
        current += 1
        d -= timedelta(days=1)

    # Рекорд: максимальная серия 'done' по всем отметкам.
    done_days = sorted(day for day, st in day_map.items() if st == "done")
    best = run = 0
    prev: Optional[date] = None
    for ds in done_days:
        cur = date.fromisoformat(ds)
        run = run + 1 if prev and (cur - prev).days == 1 else 1
        best = max(best, run)
        prev = cur

    # Неделя для визуализации «цепочка звёзд»: 6 дней назад … сегодня.
    week = [
        day_map.get((today - timedelta(days=6 - i)).isoformat()) == "done"
        for i in range(7)
    ]
    return {"current": current, "best": max(best, current), "week": week}


class JsonHabitsRepo:
    """Постоянное файловое хранилище для локального запуска (без СУБД)."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = threading.RLock()

    def _load(self) -> Dict[str, List[Dict[str, Any]]]:
        if not self.path.exists():
            return {"habits": [], "logs": []}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            data.setdefault("habits", [])
            data.setdefault("logs", [])
            return data
        except Exception:
            return {"habits": [], "logs": []}

    def _save(self, data: Dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.path)

    def list_habits(self, include_archived: bool = False) -> List[Dict[str, Any]]:
        with self.lock:
            hs = self._load()["habits"]
            if not include_archived:
                hs = [h for h in hs if not h.get("archived")]
            return sorted(hs, key=lambda h: (h.get("sort_order", 0), h.get("created_at", "")))

    def get_habit(self, habit_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            for h in self._load()["habits"]:
                if h["id"] == habit_id:
                    return h
        return None

    def add_habit(self, title: str, icon: str = "⭐") -> Dict[str, Any]:
        with self.lock:
            data = self._load()
            habit = {
                "id": uuid.uuid4().hex[:12],
                "title": title,
                "icon": icon or "⭐",
                "created_at": _now_iso(),
                "sort_order": len(data["habits"]),
                "archived": False,
                "best_streak": 0,
            }
            data["habits"].append(habit)
            self._save(data)
            return habit

    def update_habit(self, habit_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self.lock:
            data = self._load()
            for h in data["habits"]:
                if h["id"] == habit_id:
                    h.update(fields)
                    self._save(data)
                    return h
        return None

    def delete_habit(self, habit_id: str) -> bool:
        with self.lock:
            data = self._load()
            before = len(data["habits"])
            data["habits"] = [h for h in data["habits"] if h["id"] != habit_id]
            data["logs"] = [l for l in data["logs"] if l["habit_id"] != habit_id]
            self._save(data)
            return len(data["habits"]) < before

    def set_log(self, habit_id: str, day: str, status: Optional[str]) -> Optional[Dict[str, Any]]:
        """status: 'done'|'skipped' — отметить; None/'clear' — снять отметку."""
        with self.lock:
            data = self._load()
            logs = [l for l in data["logs"] if not (l["habit_id"] == habit_id and l["day"] == day)]
            log = None
            if status in ("done", "skipped"):
                log = {"habit_id": habit_id, "day": day, "status": status, "marked_at": _now_iso()}
                logs.append(log)
            data["logs"] = logs
            # обновляем рекорд привычки
            for h in data["habits"]:
                if h["id"] == habit_id:
                    st = compute_streak(self._logmap(logs, habit_id))
                    if st["best"] > int(h.get("best_streak", 0)):
                        h["best_streak"] = st["best"]
            self._save(data)
            return log

    def all_logs(self) -> List[Dict[str, Any]]:
        with self.lock:
            return self._load()["logs"]

    @staticmethod
    def _logmap(logs: List[Dict[str, Any]], habit_id: str) -> Dict[str, str]:
        return {l["day"]: l["status"] for l in logs if l["habit_id"] == habit_id}

    def logmap_for(self, habit_id: str) -> Dict[str, str]:
        return self._logmap(self.all_logs(), habit_id)


class PgHabitsRepo:
    """Production-хранилище: PostgreSQL через DATABASE_URL (psycopg 3)."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.lock = threading.RLock()

    def _conn(self):
        import psycopg  # ленивый импорт: pip install "psycopg[binary]"

        conn = psycopg.connect(self.dsn, autocommit=False)
        return conn

    def _ensure(self, conn) -> None:
        with conn.cursor() as cur:
            cur.execute(PG_DDL)
        conn.commit()

    def list_habits(self, include_archived: bool = False) -> List[Dict[str, Any]]:
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            q = "SELECT id, title, icon, created_at, sort_order, archived, best_streak FROM habits"
            if not include_archived:
                q += " WHERE NOT archived"
            q += " ORDER BY sort_order, created_at"
            with conn.cursor() as cur:
                cur.execute(q)
                rows = cur.fetchall()
            return [
                {
                    "id": r[0], "title": r[1], "icon": r[2],
                    "created_at": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3]),
                    "sort_order": r[4], "archived": bool(r[5]), "best_streak": int(r[6] or 0),
                }
                for r in rows
            ]

    def get_habit(self, habit_id: str) -> Optional[Dict[str, Any]]:
        for h in self.list_habits(include_archived=True):
            if h["id"] == habit_id:
                return h
        return None

    def add_habit(self, title: str, icon: str = "⭐") -> Dict[str, Any]:
        hid = uuid.uuid4().hex[:12]
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            with conn.cursor() as cur:
                cur.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM habits")
                order = cur.fetchone()[0]
                cur.execute(
                    "INSERT INTO habits (id, title, icon, sort_order) VALUES (%s, %s, %s, %s)",
                    (hid, title, icon or "⭐", order),
                )
            conn.commit()
        habit = self.get_habit(hid)
        assert habit is not None
        return habit

    def update_habit(self, habit_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        allowed = {"title", "icon", "archived", "sort_order", "best_streak"}
        sets = {k: v for k, v in fields.items() if k in allowed}
        if not sets:
            return self.get_habit(habit_id)
        cols = ", ".join(f"{k} = %s" for k in sets)
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE habits SET {cols} WHERE id = %s",  # noqa: S608 — ключи из белого списка
                    (*sets.values(), habit_id),
                )
            conn.commit()
        return self.get_habit(habit_id)

    def delete_habit(self, habit_id: str) -> bool:
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            with conn.cursor() as cur:
                cur.execute("DELETE FROM habits WHERE id = %s", (habit_id,))
                n = cur.rowcount
            conn.commit()
        return n > 0

    def set_log(self, habit_id: str, day: str, status: Optional[str]) -> Optional[Dict[str, Any]]:
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM habit_logs WHERE habit_id = %s AND day = %s",
                    (habit_id, day),
                )
                if status in ("done", "skipped"):
                    cur.execute(
                        "INSERT INTO habit_logs (habit_id, day, status) VALUES (%s, %s, %s)",
                        (habit_id, day, status),
                    )
            conn.commit()
        st = compute_streak(self.logmap_for(habit_id))
        self.update_habit(habit_id, {"best_streak": st["best"]})
        if status in ("done", "skipped"):
            return {"habit_id": habit_id, "day": day, "status": status, "marked_at": _now_iso()}
        return None

    def all_logs(self) -> List[Dict[str, Any]]:
        with self.lock, self._conn() as conn:
            self._ensure(conn)
            with conn.cursor() as cur:
                cur.execute("SELECT habit_id, day, status, marked_at FROM habit_logs")
                rows = cur.fetchall()
        return [
            {
                "habit_id": r[0],
                "day": r[1].isoformat() if hasattr(r[1], "isoformat") else str(r[1]),
                "status": r[2],
                "marked_at": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3]),
            }
            for r in rows
        ]

    def logmap_for(self, habit_id: str) -> Dict[str, str]:
        return {
            l["day"]: l["status"] for l in self.all_logs() if l["habit_id"] == habit_id
        }


_repo: Optional[Any] = None
_repo_lock = threading.Lock()


def get_repo():
    """Singleton: PostgreSQL при DATABASE_URL, иначе JSON-файл."""
    global _repo
    with _repo_lock:
        if _repo is None:
            dsn = os.environ.get("DATABASE_URL", "").strip()
            if dsn:
                _repo = PgHabitsRepo(dsn)
            else:
                path = Path(
                    os.environ.get("KOLOBOK_HABITS_FILE")
                    or (BASE_DIR / "data" / "habits.json")
                )
                _repo = JsonHabitsRepo(path)
        return _repo


def reset_repo() -> None:
    """Для тестов: сбросить singleton."""
    global _repo
    with _repo_lock:
        _repo = None


def habits_view(repo=None) -> Dict[str, Any]:
    """Список привычек с сегодняшним статусом, стриком и неделей для UI."""
    repo = repo or get_repo()
    habits = repo.list_habits()
    out = []
    for h in habits:
        logmap = repo.logmap_for(h["id"])
        st = compute_streak(logmap)
        out.append(
            {
                **h,
                "today": logmap.get(today_str()),
                "streak": st["current"],
                "best_streak": max(int(h.get("best_streak", 0)), st["best"]),
                "week": st["week"],
            }
        )
    return {"habits": out, "today": today_str()}
