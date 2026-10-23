r"""Проверка initData из Telegram Mini App — безопасность удалённого управления.

Зачем: если бэкенд доступен из интернета (туннель Cloudflare/ngrok), командами
на компьютер должен управлять только владелец. Telegram подписывает initData
секретом бота, и мы можем криптографически проверить, кто открыл Mini App.

Включение (переменные окружения бэкенда):
    KOLOBOK_TG_BOT_TOKEN   — токен бота от @BotFather (никогда не коммитить!)
    KOLOBOK_ALLOWED_TG_IDS — разрешённые Telegram ID через запятую,
                             например "123456789" (узнать: напиши @userinfobot)

Без KOLOBOK_TG_BOT_TOKEN сервер считает себя локальным (слушает 127.0.0.1)
и initData не требует — для домашнего запуска ничего настраивать не нужно.

Алгоритм проверки — официальный (core.telegram.org/bots/webapp#validating-data-received-via-the-mini-app):
  secret_key = HMAC_SHA256(key=b"WebAppData", msg=bot_token)
  hash       = HMAC_SHA256(key=secret_key, msg=data_check_string) == hash из initData
  data_check_string = пары "key=value" (кроме hash), отсортированные, через "\n"
Дополнительно проверяем свежесть (auth_date) и вхождение user.id в белый список.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException

MAX_AGE_S = 86400  # initData живёт сутки


def _allowed_ids() -> List[int]:
    raw = os.environ.get("KOLOBOK_ALLOWED_TG_IDS", "")
    out = []
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
    return out


def verify_init_data(init_data: str, bot_token: str,
                     allowed_ids: Optional[List[int]] = None,
                     max_age: int = MAX_AGE_S) -> Dict[str, Any]:
    """Возвращает словарь пользователя из initData или бросает ValueError."""
    if not init_data or not bot_token:
        raise ValueError("empty init_data or bot_token")
    pairs = parse_qsl(init_data, keep_blank_values=True)
    data = dict(pairs)
    received_hash = data.pop("hash", "")
    if not received_hash:
        raise ValueError("no hash in initData")

    auth_date = int(data.get("auth_date", "0") or 0)
    if auth_date and time.time() - auth_date > max_age:
        raise ValueError("initData is too old")

    check_lines = [f"{k}={data[k]}" for k in sorted(data)]
    data_check_string = "\n".join(check_lines)
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calc = hmac.new(secret, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc, received_hash):
        raise ValueError("bad hash — initData not from Telegram")

    user_raw = data.get("user")
    user = json.loads(user_raw) if user_raw else {}
    uid = int(user.get("id", 0) or 0)
    ids = allowed_ids if allowed_ids is not None else _allowed_ids()
    if ids and uid not in ids:
        raise ValueError(f"user {uid} is not allowed")
    return user


def require_tg_user(x_tg_init_data: Optional[str] = Header(default=None)) -> Optional[Dict[str, Any]]:
    """FastAPI-зависимость: локально пускает всех, с токеном — только владельца."""
    bot_token = os.environ.get("KOLOBOK_TG_BOT_TOKEN", "").strip()
    if not bot_token:
        return None  # локальный режим
    if not x_tg_init_data:
        raise HTTPException(status_code=403, detail="Missing X-TG-Init-Data header.")
    try:
        return verify_init_data(x_tg_init_data, bot_token)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=f"initData check failed: {exc}")
