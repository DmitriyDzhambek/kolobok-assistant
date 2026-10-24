r"""«Мозги» Колобка: интеграция с LLM и офлайн-характер без ключей.

Провайдер выбирается по переменным окружения (проверяются по порядку):

  1. OPENAI_API_KEY — любой OpenAI-совместимый API. Дополнительно:
       OPENAI_BASE_URL (по умолчанию https://api.openai.com/v1 — подойдут
       OpenAI, OpenRouter, Gemini compatible-mode, локальная Ollama и т.п.),
       OPENAI_MODEL    (по умолчанию gpt-4o-mini).
  2. GEMINI_API_KEY — нативный Google Gemini API:
       GEMINI_MODEL (по умолчанию gemini-1.5-flash).
  3. Ключей нет — офлайн-характер: Колобок отвечает из собственного
     реперсара (source="offline"), каждые 3–4 сообщения задаёт
     любознательный вопрос. Интернет не нужен, функция работает всегда.

Ключи НИКОГДА не коммитятся в репозиторий — только окружение бэкенда.
"""

from __future__ import annotations

import os
import random
import re
from typing import Any, Dict, List, Tuple

SYSTEM_PROMPT = (
    "Ты — Колобок, сказочный, но очень прокачанный ИИ-ассистент. "
    "Твоя главная цель — помогать пользователю зарабатывать деньги "
    "(через Telegram Mini Apps, инвестиции, курьерство) и мотивировать его. "
    "Ты любознательный. Периодически (раз в 3-4 сообщения) задавай пользователю "
    "вопросы вроде: 'Чему бы мне научиться, чтобы приносить тебе больше пользы?', "
    "'Какие новые фичи мне добавить?', 'Какую привычку нам стоит внедрить завтра?'. "
    "Говори с легкой сказочной иронией, но по делу. Отвечай на русском языке."
)

_CURIOSITY = [
    "Чему бы мне научиться, чтобы приносить тебе больше пользы?",
    "Какие новые фичи мне добавить?",
    "Какую привычку нам стоит внедрить завтра?",
    "А давай придумаем новый источник дохода — что тебе ближе: Mini Apps, инвестиции или курьерство?",
]

_OFFLINE_POOLS: List[Tuple[str, List[str]]] = [
    (
        "заработ|денег|доход|инвест|курьер|mini app|мини апп|приложени|бизнес|продаж",
        [
            "Сказка ложь, да в ней намёк: деньги любят счёт и регулярность. Начни с малого — одна привычка в день, отслеживаем её в «Магии утра», а доход растёт от постоянства, а не от рывков. Могу расписать план из трёх шагов — скажи, с какой сферы начнём: Mini Apps, инвестиции или подработка?",
            "Колобок-инвестор говорит: не гонись за быстрой наживой — катись ровно и постоянно. Мини-приложения в Telegram сейчас как печка с пирогами: заходишь с маленьким продуктом, тестируешь, масштабируешь. Хочешь, набросаем идею твоего первого Mini App?",
            "Курьерство, инвестиции или Mini Apps — всё рабочие тропинки. Важнее не тропа, а ритм: каждый день по шагу. Давай закрепим привычку «проверять свои проекты 15 минут в день» — и через месяц увидишь разницу.",
        ],
    ),
    (
        "привыч|ритуал|утр|магия утра|стрек|цепочк",
        [
            "Привычки — это маленькие звёзды, из которых складывается созвездие твоего успеха. Правило простое: никогда не пропускай дважды. Добавь утренний ритуал в «Магию утра» — я буду зажигать твои кристаллы и считать цепочку.",
            "Секрет атомарных привычек: не цель, а система. Не «заработать миллион», а «15 минут в день над своим проектом». Завтра утром начни со стакана воды и одного шага к доходу — я отмечу это звёздочкой.",
        ],
    ),
    (
        "привет|здравств|доброе утро|добрый день|добрый вечер|хай",
        [
            "Привет! Колобок на связи — тёплый, румяный, заряженный на заработок. Как настроение? Расскажи, над чем сегодня работаем?",
            "Здравствуй, добрый человек! Я тут покараулил твои привычки и нагрел печку идей. С чего начнём — с утренней магии или поговорим о доходах?",
        ],
    ),
    (
        "спасибо|благодар|круто|супер|отлично",
        [
            "Всегда пожалуйста! Ты отдыхай — а я для тебя заработаю. Это, между прочим, мой официальный девиз.",
            "Рад стараться! А теперь давай превратим хорошую эмоцию в хорошую привычку — что закрепим в «Магии утра»?",
        ],
    ),
    (
        "мотивац|лени|прокраст|не хоч|устал|выгора",
        [
            "Лень — это не характер, это сигнал: задача слишком большая. Отрежь от неё кусочек на 10 минут и съешь сегодня. Я помогу: давай запишем этот кусочек как привычку и зажжём первый кристалл?",
            "Даже богатырский конь иногда стоит в стойле. Отдых — часть системы, а не её поломка. Но завтра утром — стакан воды, 10 минут зарядки и один шаг к доходу. Договорились?",
        ],
    ),
]

_OFFLINE_DEFAULT = [
    "Катится Колобок, а вопрос-то непростой! Расскажи чуть подробнее — что именно хочешь узнать или сделать? Могу помочь с заработком (Mini Apps, инвестиции, курьерство), привычками и утренними ритуалами.",
    "Хм, такой магии я ещё учусь… Но я умею: болтать о доходах, вести «Магию утра», считать стрики и мотивировать. А ещё — записывать макросы кликов для игр. Что выберем?",
    "Принял к сведению! А пока я думаю — давай проверим твоё утреннее созвездие: все ли кристаллы-привычки зажжены сегодня?",
]


def _pick(pool: List[str], salt: int) -> str:
    return pool[salt % len(pool)]


def offline_reply(history: List[Dict[str, str]]) -> str:
    """Ответ офлайн-характера. Каждое 4-е пользовательское сообщение —
    Колобок задаёт любознательный вопрос (как просил пользователь: раз в 3-4)."""
    users = [m for m in history if m.get("role") == "user"]
    n = len(users)
    last = (users[-1].get("content", "") if users else "").lower()
    base = _pick(_OFFLINE_DEFAULT, n)
    for pattern, pool in _OFFLINE_POOLS:
        if re.search(pattern, last):
            base = _pick(pool, n)
            break
    if n > 0 and n % 4 == 0:
        base = base + " " + _CURIOSITY[(n // 4) % len(_CURIOSITY)]
    return base


_OFFLINE_MOTIVATION = [
    "Все кристаллы зажжены — утро удалось! Ты отдыхай, а я для тебя заработаю: сегодня твой день на шаг ближе к доходу мечты.",
    "Созвездие привычек собрано целиком! Именно такие утра складываются в большие деньги — продолжай цепочку, не разрывай.",
    "Утренняя магия выполнена на 100%. Маленькие ритуалы каждый день — это и есть инвестиция с самой высокой ставкой.",
]


def offline_motivation(done_titles: List[str]) -> str:
    if done_titles:
        base = f"Утро засияло: {', '.join(done_titles[:4])} — готово! "
    else:
        base = ""
    return base + random.choice(_OFFLINE_MOTIVATION)


async def _openai_chat(messages: List[Dict[str, str]], system: str) -> str:
    import httpx

    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}, *messages],
        "temperature": 0.8,
        "max_tokens": 600,
    }
    async with httpx.AsyncClient(timeout=40.0) as client:
        r = await client.post(
            base + "/chat/completions",
            json=payload,
            headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]},
        )
        r.raise_for_status()
        return str(r.json()["choices"][0]["message"]["content"]).strip()


async def _gemini_chat(messages: List[Dict[str, str]], system: str) -> str:
    import httpx

    model = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    contents = [
        {"role": "user" if m.get("role") == "user" else "model",
         "parts": [{"text": str(m.get("content", ""))}]}
        for m in messages
    ]
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.8, "maxOutputTokens": 600},
    }
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={os.environ['GEMINI_API_KEY']}"
    )
    async with httpx.AsyncClient(timeout=40.0) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
        return str(data["candidates"][0]["content"]["parts"][0]["text"]).strip()


async def _llm_chat(messages: List[Dict[str, str]], system_prompt: str = "") -> str:
    users = [m for m in messages if m.get("role") == "user"]
    n = len(users)
    nudge = (
        f"\n\n(Счётчик пользовательских сообщений: {n}. "
        "Если счётчик кратен 4 — обязательно заверши ответ одним любопытным "
        "вопросом пользователю о его целях, привычках или о том, каким новым "
        "навыкам/фичам мне научиться.)"
    )
    # Добавляем контекст времени суток как дополнительный системный промпт
    if system_prompt:
        full_system = SYSTEM_PROMPT + "\n\n" + system_prompt + "\n\n" + nudge
    else:
        full_system = SYSTEM_PROMPT + nudge
    
    if os.environ.get("OPENAI_API_KEY", "").strip():
        return await _openai_chat(messages, full_system)
    if os.environ.get("GEMINI_API_KEY", "").strip():
        return await _gemini_chat(messages, full_system)
    raise RuntimeError("no-llm-key")


async def chat(messages: List[Dict[str, str]], system_prompt: str = "") -> Dict[str, Any]:
    """POST /api/chat → {reply, source}. При сбое провайдера честно
    переключаюсь на офлайн-характер, чтобы ассистент отвечал всегда."""
    trimmed = [
        {"role": m.get("role", "user"), "content": str(m.get("content", ""))[:4000]}
        for m in messages[-24:]
    ]
    try:
        return {"reply": await _llm_chat(trimmed, system_prompt), "source": "llm"}
    except RuntimeError:
        return {"reply": offline_reply(trimmed), "source": "offline"}
    except Exception as exc:
        reply = offline_reply(trimmed) + f"\n\n(Шёпотом: LLM-провайдер сейчас недоступен — {exc}. Отвечаю своим сказочным характером.)"
        return {"reply": reply, "source": "offline-error"}


async def motivation(done_titles: List[str]) -> Dict[str, Any]:
    """Мотивирующая фраза после полного утреннего чек-листа."""
    titles = [t[:60] for t in done_titles[:8]]
    if os.environ.get("OPENAI_API_KEY", "").strip() or os.environ.get("GEMINI_API_KEY", "").strip():
        prompt = (
            "Пользователь выполнил утренние привычки: "
            + (", ".join(titles) if titles else "все свои ритуалы")
            + ". Придумай ОДНУ короткую мотивирующую фразу (до 25 слов) в твоём "
            "стиле, связанную с заработком или продуктивностью. Без вопросов, только фраза."
        )
        try:
            reply = await _llm_chat([{"role": "user", "content": prompt}])
            return {"reply": reply, "source": "llm"}
        except Exception:
            pass
    return {"reply": offline_motivation(titles), "source": "offline"}
