"""Тесты макрос-бэкенда Колобка без реальной мыши/клавиатуры.

pynput и pyautogui подменяются заглушками, поэтому тест проверяет именно
логику FastAPI-эндпоинтов, конечный автомат Engine, сохранение макроса
и цикл воспроизведения с repeat_count.

Запуск (в sandbox или на Windows, нужны fastapi+httpx):
    python3 backend/test_macro_server.py
"""

from __future__ import annotations

import json
import sys
import time
import types
from pathlib import Path

BACKEND = Path(__file__).resolve().parent

# --- заглушки pynput / pyautogui ДО импорта сервера -------------------------


class FakeKey:
    def __init__(self, name):
        self.name = name


class FakeButton:
    def __init__(self, name):
        self.name = name

    def __str__(self):
        return "Button." + self.name


class FakeListener:
    kind = "base"
    registry: dict[str, list] = {}

    def __init__(self, **cb):
        self.cb = cb
        self.started = False
        self.stopped = False

    def start(self):
        self.started = True
        self.registry.setdefault(self.kind, []).append(self)

    def stop(self):
        self.stopped = True

    def join(self):
        pass


class FakeMouseListener(FakeListener):
    kind = "mouse"


class FakeKeyListener(FakeListener):
    kind = "keyboard"


fake_pynput = types.ModuleType("pynput")
fake_mouse_mod = types.ModuleType("pynput.mouse")
fake_mouse_mod.Listener = FakeMouseListener
fake_mouse_mod.Button = types.SimpleNamespace(
    left=FakeButton("left"), right=FakeButton("right"), middle=FakeButton("middle")
)
fake_kb_mod = types.ModuleType("pynput.keyboard")
fake_kb_mod.Listener = FakeKeyListener
fake_kb_mod.Key = types.SimpleNamespace(esc=FakeKey("esc"), f8=FakeKey("f8"), f9=FakeKey("f9"))
fake_pynput.mouse = fake_mouse_mod
fake_pynput.keyboard = fake_kb_mod

gui_calls: list[tuple] = []


class FakeFailSafe(Exception):
    pass


fake_gui = types.ModuleType("pyautogui")
fake_gui.FAILSAFE = True
fake_gui.PAUSE = 0.01
fake_gui.FailSafeException = FakeFailSafe
fake_gui.size = lambda: (1920, 1080)
fake_gui.moveTo = lambda x, y, **k: gui_calls.append(("move", x, y))
fake_gui.mouseDown = lambda x=None, y=None, button="left", **k: gui_calls.append(("down", x, y, button))
fake_gui.mouseUp = lambda x=None, y=None, button="left", **k: gui_calls.append(("up", x, y, button))
fake_gui.scroll = lambda clicks, x=None, y=None, **k: gui_calls.append(("scroll", clicks, x, y))
fake_gui.hscroll = lambda clicks, x=None, y=None, **k: gui_calls.append(("hscroll", clicks, x, y))

sys.modules["pynput"] = fake_pynput
sys.modules["pynput.mouse"] = fake_mouse_mod
sys.modules["pynput.keyboard"] = fake_kb_mod
sys.modules["pyautogui"] = fake_gui

sys.path.insert(0, str(BACKEND))
import macro_server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# Тесты пишут в временную папку, чтобы не трогать реальные макросы пользователя.
macro_server.MACRO_DIR = Path("/tmp/kolobok-macro-test")
macro_server.MACRO_PATH = macro_server.MACRO_DIR / "macro.json"
if macro_server.MACRO_PATH.exists():
    macro_server.MACRO_PATH.unlink()
macro_server.engine.macro_meta = None

client = TestClient(macro_server.app)
fails: list[str] = []


def check(name: str, ok: bool, extra: str = "") -> None:
    print(("OK   " if ok else "FAIL ") + name + ((" — " + extra) if extra and not ok else ""))
    if not ok:
        fails.append(name)


def wait_state(state: str, timeout: float = 5.0) -> dict:
    st = client.get("/api/status").json()
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        st = client.get("/api/status").json()
        if st["state"] == state:
            return st
        time.sleep(0.05)
    return st


# 1. Начальный статус ---------------------------------------------------------
st = client.get("/api/status").json()
check("status idle", st["state"] == "idle", json.dumps(st, ensure_ascii=False))
check("hotkeys advertised", st["hotkeys"]["record_stop"] == "F8 или ESC")

# 2. play без макроса -> 404 --------------------------------------------------
r = client.post("/api/play", json={"repeat_count": 1})
check("play without macro -> 404", r.status_code == 404, str(r.status_code))

# 3. Запись: старт, события, стоп по F8 --------------------------------------
r = client.post("/api/record")
check("record starts", r.status_code == 200 and r.json()["state"] == "recording")

ml = FakeListener.registry["mouse"][-1]
kl = FakeListener.registry["keyboard"][-1]
check("mouse+keyboard listeners started", ml.started and kl.started)

ml.cb["on_move"](100, 200)
ml.cb["on_click"](100, 200, fake_mouse_mod.Button.left, True)
time.sleep(0.05)  # гарантия, что throttle движения пропустит вторую точку
ml.cb["on_move"](120, 220)
ml.cb["on_click"](100, 200, fake_mouse_mod.Button.left, False)
ml.cb["on_scroll"](300, 300, 0, -3)

stop_ret = kl.cb["on_press"](FakeKey("f8"))
check("F8 stops recording", stop_ret is False)

st = wait_state("idle")
check("state back to idle", st["state"] == "idle", json.dumps(st, ensure_ascii=False))
check("macro saved", macro_server.MACRO_PATH.exists())
meta = st["macro"] or {}
check("macro meta events>=5", meta.get("events", 0) >= 5, json.dumps(st, ensure_ascii=False))

macro = json.loads(macro_server.MACRO_PATH.read_text(encoding="utf-8"))
types_seen = {e["type"] for e in macro["events"]}
check("event types move/click/scroll", {"move", "click", "scroll"} <= types_seen, str(types_seen))
check("screen recorded", macro["screen"] == {"w": 1920, "h": 1080})
check("timestamps monotonic", all(
    macro["events"][i]["t"] <= macro["events"][i + 1]["t"]
    for i in range(len(macro["events"]) - 1)
))

# 4. play во время записи невозможен; toggle-остановка записи -----------------
r = client.post("/api/record")
check("second record starts (toggle)", r.json()["state"] == "recording")
r = client.post("/api/record")  # повторный запрос = остановка
check("toggle stops recording", r.json()["state"] in ("stopping", "idle"), str(r.json()))
wait_state("idle")

# 5. Воспроизведение с repeat_count=2 ----------------------------------------
gui_calls.clear()
n_events = len(macro["events"])
r = client.post("/api/play", json={"repeat_count": 2, "speed": 4.0})
check("play starts", r.status_code == 200 and r.json()["state"] == "playing", r.text)
st = wait_state("idle")
check("play finished", st["state"] == "idle", json.dumps(st, ensure_ascii=False))
check("play had no error", not st.get("error"), str(st.get("error")))

moves = [c for c in gui_calls if c[0] == "move"]
downs = [c for c in gui_calls if c[0] == "down"]
ups = [c for c in gui_calls if c[0] == "up"]
scrolls = [c for c in gui_calls if c[0] == "scroll"]
check("moves x2", len(moves) == 2 * sum(1 for e in macro["events"] if e["type"] == "move"), f"{len(moves)} vs {n_events}")
check("clicks down x2", len(downs) == 2 * sum(1 for e in macro["events"] if e["type"] == "click" and e["pressed"]))
check("clicks up x2", len(ups) == 2 * sum(1 for e in macro["events"] if e["type"] == "click" and not e["pressed"]))
check("scroll x2", len(scrolls) == 2 * sum(1 for e in macro["events"] if e["type"] == "scroll"))
check("coords preserved", ("move", 100, 200) in moves and ("down", 100, 200, "left") in downs)

# 6. Валидация repeat_count ---------------------------------------------------
r = client.post("/api/play", json={"repeat_count": 0})
check("repeat_count=0 -> 422", r.status_code == 422, str(r.status_code))
r = client.post("/api/play", json={"repeat_count": 999999})
check("repeat_count huge -> 422", r.status_code == 422, str(r.status_code))

# 7. /api/stop и /api/macro ---------------------------------------------------
r = client.post("/api/stop")
check("stop when idle is safe", r.status_code == 200)
r = client.get("/api/macro")
check("macro meta endpoint", r.status_code == 200 and r.json()["events"] == n_events, r.text)
r = client.post("/api/record/stop")
check("record/stop when idle -> 409", r.status_code == 409, str(r.status_code))

# 8. F9 останавливает воспроизведение (длинный макрос) ------------------------
long_events = [{"t": i * 400, "type": "move", "x": i, "y": i} for i in range(50)]
macro_server.MACRO_PATH.write_text(
    json.dumps({"version": 1, "created": "test", "screen": None, "events": long_events}),
    encoding="utf-8",
)
r = client.post("/api/play", json={"repeat_count": 3})
check("long play starts", r.json()["state"] == "playing", r.text)
time.sleep(0.3)
kl = FakeListener.registry["keyboard"][-1]
kl.cb["on_press"](FakeKey("f9"))
st = wait_state("idle", timeout=3)
check("F9 stopped playback early", st["state"] == "idle", json.dumps(st, ensure_ascii=False))

print()
if fails:
    print("BACKEND TESTS FAILED:", ", ".join(fails))
    sys.exit(1)
print("BACKEND TESTS OK (запись, F8/F9, toggle, play repeat_count, валидация, stop)")
