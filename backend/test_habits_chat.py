"""Тесты «Мозгов» (LLM-чат) и «Магии утра» (привычки, стрики) без внешней БД и LLM.

Хранилище — временный JSON-файл (KOLOBOK_HABITS_FILE), LLM-ключи сброшены,
поэтому /api/chat отвечает офлайн-характер (source=offline) — его логика
(включая любознательный вопрос каждый 4-й ответ) проверяется здесь же.
Проверка initData Telegram тестируется с тестовым токеном и настоящей HMAC-подписью.

Запуск: python3 backend/test_habits_chat.py   (нужны fastapi+httpx)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.parse
from datetime import date, timedelta
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
TMP = Path("/tmp/kolobok-habits-test.json")
if TMP.exists():
    TMP.unlink()

os.environ["KOLOBOK_HABITS_FILE"] = str(TMP)
for k in ("OPENAI_API_KEY", "GEMINI_API_KEY", "DATABASE_URL",
          "KOLOBOK_TG_BOT_TOKEN", "KOLOBOK_ALLOWED_TG_IDS"):
    os.environ.pop(k, None)

sys.path.insert(0, str(BACKEND))
import macro_server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(macro_server.app)
fails: list[str] = []


def check(name: str, ok: bool, extra: str = "") -> None:
    print(("OK   " if ok else "FAIL ") + name + ((" — " + extra) if extra and not ok else ""))
    if not ok:
        fails.append(name)


# ---------- «Магия утра»: CRUD ----------
r = client.get("/api/habits")
check("habits empty start", r.status_code == 200 and r.json()["habits"] == [], r.text)

r = client.post("/api/habits", json={"title": "Выпить стакан воды", "icon": "💧"})
check("add habit water", r.status_code == 200 and r.json()["title"] == "Выпить стакан воды", r.text)
h_water = r.json()
r = client.post("/api/habits", json={"title": "Зарядка 10 минут", "icon": "🏃"})
h_sport = r.json()
check("add habit sport", r.status_code == 200)

r = client.post("/api/habits", json={"title": "   "})
check("blank title -> 422", r.status_code == 422, str(r.status_code))
r = client.post("/api/habits", json={})
check("no title -> 422", r.status_code == 422, str(r.status_code))

r = client.patch(f"/api/habits/{h_water['id']}", json={"title": "Стакан воды утром"})
check("patch title", r.status_code == 200 and r.json()["title"] == "Стакан воды утром", r.text)
r = client.patch(f"/api/habits/{h_water['id']}", json={})
check("patch empty -> 422", r.status_code == 422, str(r.status_code))
r = client.patch("/api/habits/nonexistent", json={"title": "x"})
check("patch missing -> 404", r.status_code == 404, str(r.status_code))

# ---------- отметки и стрики ----------
today = date.today()
yday = (today - timedelta(days=1)).isoformat()
d2 = (today - timedelta(days=2)).isoformat()

r = client.post(f"/api/habits/{h_water['id']}/log", json={"status": "done", "day": yday})
check("log yesterday done", r.status_code == 200 and r.json()["habit"]["streak"] == 1, r.text)
r = client.post(f"/api/habits/{h_water['id']}/log", json={"status": "done"})  # сегодня
check("log today done -> streak 2", r.json()["habit"]["streak"] == 2, r.text)
check("today status done", r.json()["habit"]["today"] == "done")
r = client.post(f"/api/habits/{h_water['id']}/log", json={"status": "done", "day": d2})
check("log day-2 done -> streak 3", r.json()["habit"]["streak"] == 3, r.text)
r = client.post(f"/api/habits/{h_water['id']}/log", json={"status": "skipped", "day": d2})
check("skip breaks streak -> 2", r.json()["habit"]["streak"] == 2, r.text)
check("week array len 7", len(r.json()["habit"]["week"]) == 7)
check("best_streak >= 3", r.json()["habit"]["best_streak"] >= 3, r.text)

r = client.post(f"/api/habits/{h_water['id']}/log", json={"status": "clear"})
check("clear today", r.status_code == 200 and r.json()["habit"]["today"] is None, r.text)

r = client.post(f"/api/habits/{h_water['id']}/log", json={"status": "done", "day": "bad-date"})
check("bad day -> 422", r.status_code == 422, str(r.status_code))
r = client.post("/api/habits/nonexistent/log", json={"status": "done"})
check("log missing habit -> 404", r.status_code == 404, str(r.status_code))

# мотивация, когда все привычки выполнены сегодня
client.post(f"/api/habits/{h_water['id']}/log", json={"status": "done"})
r = client.post(f"/api/habits/{h_sport['id']}/log", json={"status": "done"})
check("all_done flag", r.json().get("all_done") is True, r.text)
check("motivation attached", bool(r.json().get("motivation", {}).get("reply")), r.text)

r = client.post("/api/morning/motivation")
check("motivation endpoint", r.status_code == 200 and len(r.json()["reply"]) > 10, r.text)

# ---------- удаление ----------
r = client.delete(f"/api/habits/{h_sport['id']}")
check("delete habit", r.status_code == 200 and r.json()["ok"])
r = client.get("/api/habits")
ids = [h["id"] for h in r.json()["habits"]]
check("habit gone", h_sport["id"] not in ids and h_water["id"] in ids)

# персистентность: файл существует и содержит данные
check("json store persisted", TMP.exists() and "Стакан воды" in TMP.read_text(encoding="utf-8"))

# ---------- «Мозги»: чат офлайн-характером ----------
r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "привет, Колобок!"}]})
check("chat ok", r.status_code == 200, r.text)
j = r.json()
check("chat source offline", j.get("source") == "offline", str(j.get("source")))
check("chat reply non-empty", len(j.get("reply", "")) > 20)

# каждое 4-е пользовательское сообщение — любознательный вопрос
hist = []
q_seen = False
for i in range(4):
    hist.append({"role": "user", "content": f"расскажи про заработок {i}"})
    hist.append({"role": "assistant", "content": "ок"})
    rr = client.post("/api/chat", json={"messages": hist[:-1]})
    if i == 3:
        q_seen = "?" in rr.json()["reply"]
check("curiosity question on 4th msg", q_seen)

r = client.post("/api/chat", json={"messages": []})
check("chat empty -> 422", r.status_code == 422, str(r.status_code))
r = client.post("/api/chat", json={"messages": [{"role": "user", "content": ""}]})
check("chat blank content -> 422", r.status_code == 422, str(r.status_code))

# ---------- безопасность: initData Telegram ----------
BOT = "123456:test-bot-token"
UID = 777001


def make_init_data(user: dict, bot_token: str, auth_date: int | None = None) -> str:
    data = {
        "user": json.dumps(user, separators=(",", ":")),
        "auth_date": str(auth_date if auth_date is not None else int(time.time())),
        "query_id": "AAH-test",
    }
    check_lines = [f"{k}={data[k]}" for k in sorted(data)]
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    data["hash"] = hmac.new(secret, "\n".join(check_lines).encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(data)


good = make_init_data({"id": UID, "first_name": "D", "username": "d"}, BOT)
bad_user = make_init_data({"id": 999, "first_name": "X"}, BOT)
tampered = good.replace("hash=", "hash=00")
old = make_init_data({"id": UID}, BOT, auth_date=int(time.time()) - 200000)

os.environ["KOLOBOK_TG_BOT_TOKEN"] = BOT
os.environ["KOLOBOK_ALLOWED_TG_IDS"] = str(UID)
try:
    r = client.get("/api/habits")
    check("auth on: no header -> 403", r.status_code == 403, str(r.status_code))
    r = client.get("/api/habits", headers={"X-TG-Init-Data": good})
    check("auth on: valid initData -> 200", r.status_code == 200, str(r.status_code))
    r = client.get("/api/habits", headers={"X-TG-Init-Data": bad_user})
    check("auth on: foreign user -> 403", r.status_code == 403, str(r.status_code))
    r = client.get("/api/habits", headers={"X-TG-Init-Data": tampered})
    check("auth on: bad hash -> 403", r.status_code == 403, str(r.status_code))
    r = client.get("/api/habits", headers={"X-TG-Init-Data": old})
    check("auth on: stale auth_date -> 403", r.status_code == 403, str(r.status_code))
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "привет"}]},
                    headers={"X-TG-Init-Data": good})
    check("auth on: chat allowed for owner", r.status_code == 200, str(r.status_code))
finally:
    os.environ.pop("KOLOBOK_TG_BOT_TOKEN", None)
    os.environ.pop("KOLOBOK_ALLOWED_TG_IDS", None)

r = client.get("/api/habits")
check("auth off again: open", r.status_code == 200, str(r.status_code))

# статус макрос-движка не сломан новым роутером
r = client.get("/api/status")
check("macro status still ok", r.status_code == 200 and "state" in r.json(), r.text)

print()
if fails:
    print("HABITS/CHAT TESTS FAILED:", ", ".join(fails))
    sys.exit(1)
print("HABITS/CHAT TESTS OK (CRUD, стрики, мотивация, офлайн-LLM, initData-безопасность)")
