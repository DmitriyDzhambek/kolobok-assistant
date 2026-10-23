r"""Роутер «Мозги» (LLM-чат) и «Магия утра» (привычки, стрики, мотивация).

Эндпоинты:
  POST   /api/chat                  — диалог с Колобком {messages:[{role,content}]}
  GET    /api/habits                — привычки + сегодняшний статус + стрик + неделя
  POST   /api/habits                — добавить привычку {title, icon}
  PATCH  /api/habits/{id}           — переименовать/иконка/архив
  DELETE /api/habits/{id}           — удалить
  POST   /api/habits/{id}/log       — отметить день {status: done|skipped|clear, day?}
  POST   /api/morning/motivation    — мотивирующая фраза от Колобка

Если задан KOLOBOK_TG_BOT_TOKEN — все эндпоинты требуют валидный initData
Telegram (заголовок X-TG-Init-Data) и белый список KOLOBOK_ALLOWED_TG_IDS.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import db
import llm
from tg_auth import require_tg_user

habits_router = APIRouter(dependencies=[Depends(require_tg_user)])

_DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_ICONS = {"⭐", "💧", "🏃", "📚", "🧘", "💰", "🦷", "🌅", "🍎", "🔥", "🌙", "💪", "🧠", "🥗", "🛌", "📈"}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"] = "user"
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=30)


class HabitCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=80)
    icon: str = Field("⭐", max_length=8)


class HabitPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=80)
    icon: Optional[str] = Field(None, max_length=8)
    archived: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0, le=1000)


class LogRequest(BaseModel):
    status: Literal["done", "skipped", "clear"]
    day: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


def _get_habit_or_404(habit_id: str) -> Dict[str, Any]:
    habit = db.get_repo().get_habit(habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Привычка не найдена.")
    return habit


def _one_view(habit_id: str) -> Dict[str, Any]:
    view = db.habits_view()
    for h in view["habits"]:
        if h["id"] == habit_id:
            return h
    return _get_habit_or_404(habit_id)


# ---------------- «Мозги»: LLM-чат ----------------

@habits_router.post("/api/chat")
async def api_chat(req: ChatRequest) -> Dict[str, Any]:
    history = [m.model_dump() for m in req.messages]
    return await llm.chat(history)


@habits_router.post("/api/morning/motivation")
async def api_motivation() -> Dict[str, Any]:
    view = db.habits_view()
    done = [h["title"] for h in view["habits"] if h.get("today") == "done"]
    return await llm.motivation(done)


# ---------------- «Магия утра»: привычки ----------------

@habits_router.get("/api/habits")
def api_list_habits() -> Dict[str, Any]:
    return db.habits_view()


@habits_router.post("/api/habits")
def api_add_habit(req: HabitCreate) -> Dict[str, Any]:
    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Название привычки не может быть пустым.")
    repo = db.get_repo()
    if len(repo.list_habits()) >= 30:
        raise HTTPException(status_code=409, detail="Максимум 30 привычек — сначала удалите лишние.")
    icon = req.icon.strip() or "⭐"
    habit = repo.add_habit(title, icon)
    return _one_view(habit["id"])


@habits_router.patch("/api/habits/{habit_id}")
def api_patch_habit(habit_id: str, req: HabitPatch) -> Dict[str, Any]:
    _get_habit_or_404(habit_id)
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    if "title" in fields:
        fields["title"] = str(fields["title"]).strip()
        if not fields["title"]:
            raise HTTPException(status_code=422, detail="Название не может быть пустым.")
    if not fields:
        raise HTTPException(status_code=422, detail="Нет полей для изменения.")
    db.get_repo().update_habit(habit_id, fields)
    return _one_view(habit_id)


@habits_router.delete("/api/habits/{habit_id}")
def api_delete_habit(habit_id: str) -> Dict[str, Any]:
    _get_habit_or_404(habit_id)
    db.get_repo().delete_habit(habit_id)
    return {"ok": True, "id": habit_id}


@habits_router.post("/api/habits/{habit_id}/log")
async def api_log_habit(habit_id: str, req: LogRequest) -> Dict[str, Any]:
    _get_habit_or_404(habit_id)
    day = req.day or db.today_str()
    if req.day and not _DAY_RE.match(req.day):
        raise HTTPException(status_code=422, detail="Дата должна быть в формате ГГГГ-ММ-ДД.")
    try:
        date.fromisoformat(day)
    except ValueError:
        raise HTTPException(status_code=422, detail="Неверная дата.")
    status = None if req.status == "clear" else req.status
    db.get_repo().set_log(habit_id, day, status)
    habit = _one_view(habit_id)

    out: Dict[str, Any] = {"habit": habit}
    # Все привычки выполнены сегодня → Колобок выдаёт мотивацию (через LLM при ключе).
    view = db.habits_view()
    if view["habits"] and all(h.get("today") == "done" for h in view["habits"]):
        out["all_done"] = True
        out["motivation"] = await llm.motivation([h["title"] for h in view["habits"]])
    return out
