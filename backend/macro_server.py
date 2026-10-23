r"""Колобок — макрос-рекордер (автокликер) для Windows 10.

FastAPI-бэкенд, который:
  * POST /api/record      — запускает запись движений мыши, кликов, скроллов и пауз
                            (повторный запрос — останавливает запись, как и клавиши F8 / ESC);
  * POST /api/record/stop — остановить запись явно;
  * POST /api/play        — воспроизводит сохранённый макрос {"repeat_count": N, "speed": 1.0}
                            (стоп — клавиша F9, аварийный стоп — мышь в левый верхний угол экрана);
  * POST /api/stop        — остановить любую операцию;
  * GET  /api/status      — текущее состояние для фронтенда;
  * GET  /api/macro       — метаданные последнего макроса.

Макрос сохраняется в backend/macros/macro.json.

Запуск на Windows:
    python -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt
    python macro_server.py        (или двойной клик по start_backend.bat)

Сервер намеренно слушает только 127.0.0.1: он управляет мышью и клавиатурой,
поэтому доступен исключительно программам на этом же компьютере.
"""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
MACRO_DIR = BASE_DIR / "macros"
MACRO_PATH = MACRO_DIR / "macro.json"

# Чем реже пишутся движения мыши, тем компактнее макрос (25 точек/сек достаточно для игр).
MOVE_THROTTLE_S = 0.04
# Клавиши-стопы. Запись: F8 или ESC (как просил пользователь). Воспроизведение: F9.
RECORD_STOP_KEYS = {"f8", "esc"}
PLAY_STOP_KEYS = {"f9"}
MAX_REPEAT = 10000

PIP_HINT = (
    "Библиотеки не установлены. Выполните в папке backend: "
    "pip install -r requirements.txt"
)


class LibMissing(Exception):
    pass


class Busy(Exception):
    pass


class NoMacro(Exception):
    pass


def _require_lib(name: str) -> Any:
    """Ленивый импорт pynput/pyautogui: без них сервер всё равно стартует
    и честно отвечает 503, а тесты могут работать с заглушками."""
    try:
        if name == "pynput":
            from pynput import keyboard, mouse  # noqa: F401

            return {"keyboard": keyboard, "mouse": mouse}
        if name == "pyautogui":
            import pyautogui  # noqa: F401

            return pyautogui
    except Exception as exc:  # pragma: no cover - зависит от ОС
        raise LibMissing(f"{PIP_HINT} (не импортируется {name}: {exc})")
    raise LibMissing(f"Неизвестная библиотека: {name}")


def _macro_meta(macro: Dict[str, Any]) -> Dict[str, Any]:
    events = macro.get("events", [])
    duration = max((int(e.get("t", 0)) for e in events), default=0)
    return {
        "events": len(events),
        "duration_ms": duration,
        "created": macro.get("created"),
        "screen": macro.get("screen"),
    }


def _sleep_chunks(seconds: float, stop: threading.Event) -> bool:
    """Спит кусочками по 20 мс, чтобы мгновенно реагировать на стоп-клавишу.
    Возвращает False, если попросили остановиться."""
    if seconds <= 0:
        return not stop.is_set()
    end = time.monotonic() + seconds
    while True:
        if stop.is_set():
            return False
        left = end - time.monotonic()
        if left <= 0:
            return True
        time.sleep(min(0.02, left))


class Engine:
    """Конечный автомат: idle -> recording/playing -> idle (в фоновом потоке)."""

    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.state = "idle"
        self.error: Optional[str] = None
        self.stop_evt = threading.Event()
        self.thread: Optional[threading.Thread] = None
        self.macro_meta: Optional[Dict[str, Any]] = None
        if MACRO_PATH.exists():
            try:
                self.macro_meta = _macro_meta(
                    json.loads(MACRO_PATH.read_text(encoding="utf-8"))
                )
            except Exception:
                self.macro_meta = None

    # ---------- статус ----------
    def status(self) -> Dict[str, Any]:
        with self.lock:
            st = self.state
            if st in ("recording", "playing") and self.stop_evt.is_set():
                st = "stopping"
            return {
                "state": st,
                "error": self.error,
                "macro": self.macro_meta,
                "hotkeys": {
                    "record_stop": "F8 или ESC",
                    "play_stop": "F9 (или мышь в левый верхний угол экрана)",
                },
            }

    # ---------- запись ----------
    def start_record(self) -> None:
        _require_lib("pynput")
        with self.lock:
            if self.state != "idle":
                raise Busy("Сейчас идёт другая операция — сначала остановите её.")
            self.state = "recording"
            self.error = None
            self.stop_evt.clear()
            self.thread = threading.Thread(
                target=self._record_loop, name="macro-record", daemon=True
            )
            self.thread.start()

    def _record_loop(self) -> None:
        try:
            libs = _require_lib("pynput")
            mouse, keyboard = libs["mouse"], libs["keyboard"]
            events: List[Dict[str, Any]] = []
            t0 = time.monotonic()
            last_move = [0.0]

            screen = None
            try:
                gui = _require_lib("pyautogui")
                w, h = gui.size()
                screen = {"w": int(w), "h": int(h)}
            except Exception:
                pass

            def ms() -> int:
                return round((time.monotonic() - t0) * 1000)

            def on_move(x: float, y: float) -> None:
                now = time.monotonic()
                if now - last_move[0] >= MOVE_THROTTLE_S:
                    last_move[0] = now
                    events.append({"t": ms(), "type": "move", "x": int(x), "y": int(y)})

            def on_click(x: float, y: float, button: Any, pressed: bool) -> None:
                events.append(
                    {
                        "t": ms(),
                        "type": "click",
                        "x": int(x),
                        "y": int(y),
                        "button": getattr(button, "name", str(button)),
                        "pressed": bool(pressed),
                    }
                )

            def on_scroll(x: float, y: float, dx: int, dy: int) -> None:
                events.append(
                    {"t": ms(), "type": "scroll", "x": int(x), "y": int(y),
                     "dx": int(dx), "dy": int(dy)}
                )

            def on_press(key: Any) -> bool:
                if getattr(key, "name", None) in RECORD_STOP_KEYS:
                    self.stop_evt.set()
                    return False  # остановить слушатель клавиатуры
                return True

            ml = mouse.Listener(on_move=on_move, on_click=on_click, on_scroll=on_scroll)
            kl = keyboard.Listener(on_press=on_press)
            ml.start()
            kl.start()
            self.stop_evt.wait()
            for lst in (ml, kl):
                try:
                    lst.stop()
                except Exception:
                    pass

            with self.lock:
                if events:
                    macro = {
                        "version": 1,
                        "created": datetime.now().isoformat(timespec="seconds"),
                        "screen": screen,
                        "events": events,
                    }
                    MACRO_DIR.mkdir(parents=True, exist_ok=True)
                    MACRO_PATH.write_text(
                        json.dumps(macro, ensure_ascii=False), encoding="utf-8"
                    )
                    self.macro_meta = _macro_meta(macro)
                    self.error = None
                else:
                    self.error = "Запись пустая — события мыши не пойманы."
                self.state = "idle"
        except Exception as exc:
            with self.lock:
                self.state = "idle"
                self.error = f"Сбой записи: {exc}"

    # ---------- воспроизведение ----------
    def start_play(self, repeat: int, speed: float) -> None:
        _require_lib("pyautogui")
        _require_lib("pynput")
        if not MACRO_PATH.exists():
            raise NoMacro("Макрос ещё не записан. Сначала запишите: POST /api/record.")
        with self.lock:
            if self.state != "idle":
                raise Busy("Сейчас идёт другая операция — сначала остановите её.")
            self.state = "playing"
            self.error = None
            self.stop_evt.clear()
            self.thread = threading.Thread(
                target=self._play_loop, args=(repeat, speed),
                name="macro-play", daemon=True,
            )
            self.thread.start()

    def _play_loop(self, repeat: int, speed: float) -> None:
        kl = None
        try:
            gui = _require_lib("pyautogui")
            libs = _require_lib("pynput")
            keyboard = libs["keyboard"]
            gui.FAILSAFE = True   # мышь в левый верхний угол — аварийный стоп
            gui.PAUSE = 0.0

            macro = json.loads(MACRO_PATH.read_text(encoding="utf-8"))
            events: List[Dict[str, Any]] = macro.get("events", [])

            def on_press(key: Any) -> bool:
                if getattr(key, "name", None) in PLAY_STOP_KEYS:
                    self.stop_evt.set()
                    return False
                return True

            kl = keyboard.Listener(on_press=on_press)
            kl.start()

            speed = max(0.25, min(4.0, float(speed)))
            for _ in range(max(1, min(MAX_REPEAT, int(repeat)))):
                prev_t = 0
                for ev in events:
                    if self.stop_evt.is_set():
                        break
                    dt = (int(ev.get("t", 0)) - prev_t) / 1000.0 / speed
                    prev_t = int(ev.get("t", 0))
                    if not _sleep_chunks(dt, self.stop_evt):
                        break
                    kind = ev.get("type")
                    try:
                        if kind == "move":
                            gui.moveTo(ev["x"], ev["y"], _pause=False)
                        elif kind == "click":
                            btn = ev.get("button", "left")
                            if ev.get("pressed"):
                                gui.mouseDown(ev["x"], ev["y"], button=btn, _pause=False)
                            else:
                                gui.mouseUp(ev["x"], ev["y"], button=btn, _pause=False)
                        elif kind == "scroll":
                            if ev.get("dy"):
                                gui.scroll(ev["dy"], x=ev["x"], y=ev["y"], _pause=False)
                            if ev.get("dx"):
                                gui.hscroll(ev["dx"], x=ev["x"], y=ev["y"], _pause=False)
                    except Exception as exc:
                        failsafe = type(exc).__name__ == "FailSafeException"
                        self.stop_evt.set()
                        with self.lock:
                            self.error = (
                                "Аварийный стоп: мышь оказалась в углу экрана (failsafe)."
                                if failsafe
                                else f"Сбой при воспроизведении: {exc}"
                            )
                        break
                if self.stop_evt.is_set():
                    break
            with self.lock:
                self.state = "idle"
        except Exception as exc:
            with self.lock:
                self.state = "idle"
                self.error = f"Сбой воспроизведения: {exc}"
        finally:
            if kl is not None:
                try:
                    kl.stop()
                except Exception:
                    pass

    # ---------- управление ----------
    def request_stop(self) -> None:
        with self.lock:
            if self.state in ("recording", "playing"):
                self.stop_evt.set()

    def join_if_done(self, timeout: float = 0.0) -> None:
        th = self.thread
        if th is not None and th.is_alive() and timeout > 0:
            th.join(timeout)


engine = Engine()

app = FastAPI(title="Колобок — макрос-рекордер", version="1.0.0")

# Фронтенд Колобка живёт на локальных dev-портах Vite; другие адреса можно
# добавить переменной окружения KOLOBOK_MACRO_ORIGINS (через запятую).
_DEFAULT_ORIGINS = [
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]
_origins = [o.strip() for o in os.environ.get("KOLOBOK_MACRO_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or _DEFAULT_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class PlayRequest(BaseModel):
    repeat_count: int = Field(1, ge=1, le=MAX_REPEAT)
    speed: float = Field(1.0, ge=0.25, le=4.0)


def _guard(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except LibMissing as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Busy as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except NoMacro as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "app": "Колобок — макрос-рекордер",
        "endpoints": ["/api/status", "/api/record", "/api/record/stop",
                      "/api/play", "/api/stop", "/api/macro"],
        "docs": "/docs",
    }


@app.get("/api/status")
def api_status() -> Dict[str, Any]:
    return engine.status()


@app.get("/api/macro")
def api_macro() -> Dict[str, Any]:
    st = engine.status()
    if not st["macro"]:
        raise HTTPException(status_code=404, detail="Макрос ещё не записан.")
    return st["macro"]


@app.post("/api/record")
def api_record() -> Dict[str, Any]:
    """Запуск записи; повторный вызов во время записи — остановка (toggle)."""
    st = engine.status()
    if st["state"] in ("recording", "stopping"):
        engine.request_stop()
        return engine.status()
    _guard(engine.start_record)
    return engine.status()


@app.post("/api/record/stop")
def api_record_stop() -> Dict[str, Any]:
    if engine.status()["state"] not in ("recording", "stopping"):
        raise HTTPException(status_code=409, detail="Запись сейчас не идёт.")
    engine.request_stop()
    return engine.status()


@app.post("/api/play")
def api_play(req: PlayRequest) -> Dict[str, Any]:
    _guard(engine.start_play, req.repeat_count, req.speed)
    return engine.status()


@app.post("/api/stop")
def api_stop() -> Dict[str, Any]:
    engine.request_stop()
    return engine.status()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("KOLOBOK_MACRO_PORT", "8765"))
    print("=" * 56)
    print("  Колобок — макрос-рекордер")
    print(f"  Сервер:   http://127.0.0.1:{port}")
    print("  Запись:   POST /api/record (стоп: F8 или ESC)")
    print("  Повтор:   POST /api/play {\"repeat_count\": N} (стоп: F9)")
    print("  Фронтенд: npm run dev  →  кнопка 🖱 на панели Колобка")
    print("=" * 56)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
