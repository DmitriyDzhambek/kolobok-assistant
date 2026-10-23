# Документация проекта «Колобок»

## Бриф

Пользователь просил голосового помощника для рабочего стола Windows 10: ему говорят задачу голосом —
помощник помогает выполнить. Образ — Колобок из сказки (богатырский сказочный стиль), дизайн волшебный
и интересный. Название: «Ты отдыхай, а я для тебя заработаю». Требуется сразу рабочая версия.
Референс из чата: виджет с push-to-talk микрофоном (нажать — говорить, удерживать/пробел — диктовка,
отпустить — отправить) и подсказками о доступе к микрофону в Windows.

Этап 2 (по запросам пользователя): автокликер-макросрекордер для игрового контента (Python FastAPI +
pynput + pyautogui); превращение в Telegram Mini App (SDK, initData-безопасность, туннель — гайд
TELEGRAM-MINI-APP.md); «Мозги» — LLM-чат с характером (/api/chat); «Магия утра» — трекер привычек
со стриками и мотивацией (Atomic Habits). UI: вкладки 🌙/✨/💬, стеклянные панели, кристаллы-созвездия,
framer-motion, палитра космос+золото, мобильная адаптация под Mini App.

## Архитектура и стек

- Vite + React 18 + TypeScript. Основной backend не нужен: голос (Web Speech API), хранение задач (localStorage),
  погода (open-meteo, без ключей) — всё клиентское.
- Опциональный локальный бэкенд автокликера: `backend/macro_server.py` — Python + FastAPI + pynput (запись
  мыши/клавиш) + pyautogui (воспроизведение), только 127.0.0.1:8765. Макрос — JSON в `backend/macros/macro.json`.
- PWA (manifest.webmanifest + sw.js) → установка на рабочий стол Windows 10 как отдельное окно-приложение.
- Публикация по HTTPS обязательна для работы микрофона на машине пользователя.

## Команды запуска

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5175
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
npx tsc --noEmit                                  # типы
npx esbuild scripts/engine-smoke.mjs --bundle --platform=node --format=esm --outfile=/tmp/engine-smoke.mjs && node /tmp/engine-smoke.mjs   # движок команд
npx esbuild scripts/ssr-check.tsx --bundle --platform=node --format=esm --external:react --external:react-dom --loader:.css=empty --outfile=.tmp-ssr.mjs && node .tmp-ssr.mjs && rm .tmp-ssr.mjs  # рендер сцены

# Бэкенд (тесты работают без pynput/pyautogui — заглушки внутри):
python3 backend/test_macro_server.py       # 29 проверок: запись, F8/F9, repeat_count
python3 backend/test_habits_chat.py        # 38 проверок: привычки, стрики, чат, initData
# Реальный запуск (на машине с мышью/экраном, Windows):
cd backend && start_backend.bat   # или: pip install -r requirements.txt && python macro_server.py
```

В dev-режиме фронтенд обращается к бэкенду same-origin через Vite-прокси `/backend-api`
(→ http://127.0.0.1:8765, см. vite.config.ts) — работает и на ПК пользователя, и в облачном превью.

## Переменные окружения

Секретов в репозитории нет; ключи задаются только в окружении бэкенда/сборки:

- `VITE_MACRO_API_URL` — адрес бэкенда для фронтенда (по умолчанию в dev — прокси `/backend-api`,
  в сборке — `http://localhost:8765`);
- `KOLOBOK_MACRO_PORT` — порт сервера (по умолчанию 8765);
- `KOLOBOK_MACRO_BACKEND` — хост:порт для Vite-прокси (по умолчанию 127.0.0.1:8765);
- `KOLOBOK_MACRO_ORIGINS` — дополнительные CORS-origins через запятую
  (по умолчанию localhost/127.0.0.1 порты 4173, 5173–5175);
- `DATABASE_URL` — PostgreSQL для привычек в production (без него — JSON-файл, не SQLite);
- `KOLOBOK_HABITS_FILE` — путь JSON-хранилища привычек (по умолчанию backend/data/habits.json);
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` — LLM, любой OpenAI-совместимый API
  (модель по умолчанию gpt-4o-mini);
- `GEMINI_API_KEY` / `GEMINI_MODEL` — альтернативный провайдер Gemini (по умолчанию gemini-1.5-flash);
- `KOLOBOK_TG_BOT_TOKEN` / `KOLOBOK_ALLOWED_TG_IDS` — проверка initData Telegram: только владельцы
  из белого списка (без них — локальный режим без проверки).

## Установка на Windows 10 (памятка пользователю)

1. Открыть опубликованный HTTPS-адрес в Google Chrome.
2. Разрешить микрофон по запросу браузера.
3. Меню Chrome (⋮) → «Установить Колобок…» (или кнопка «⤓ Установить на рабочий стол» в шапке).
4. Автозапуск: Win+R → `shell:startup` → положить ярлык установленного приложения.

## Решения по движку команд

- `\b` в JS-регулярках не работает для кириллицы, поэтому границы слов в `parseDuration` заданы
  lookaround'ами `(?<![а-яёa-z0-9])…(?![а-яё])`. Без этого «напомни … через час» не распознавалось.
- Поддержаны формы длительности: «полчаса», «через час», «через два часа», «сутки/день».
- Погода: город сначала проходит `extractCity` (снятие «какая погода», предлогов, «городе»), затем
  `cityCandidates` (алиасы: Питер/СПб/ЕКат/НСК/Владик/Ростов; падежные варианты «Твери»→«Тверь»,
  «Петербурге»→«Петербург», «Нижнем Новгороде»→«Нижний Новгород»). Ответы геокодера ранжируются
  `placeScore` (совпадение имени, страна RU, население) и принимаются только при пороге 400 —
  иначе «Твери» давало «Тверия, Израиль», а «Москве» — «Москверо, США».
- Погодный API (open-meteo) доступен без ключей и проверен из sandbox'а.

## Решения по макрос-рекордеру (автокликер)

- Стек по запросу пользователя: FastAPI + pynput (запись) + pyautogui (воспроизведение), макрос в JSON.
- Эндпоинты: `POST /api/record` (toggle: повторный запрос останавливает запись), `POST /api/record/stop`,
  `POST /api/play {repeat_count, speed}`, `POST /api/stop`, `GET /api/status`, `GET /api/macro`.
- Горячие клавиши: запись — F8 или ESC (как просил пользователь: он будет переключаться в окно игры),
  воспроизведение — F9; плюс pyautogui FAILSAFE (мышь в левый верхний угол — аварийный стоп).
- Движения мыши пишутся с тротлингом 25 событий/сек — макрос компактный, но плавный.
- Паузы между событиями соблюдаются через `_sleep_chunks` (сон по 20 мс) — стоп-клавиша срабатывает мгновенно.
- pynput/pyautogui импортируются лениво: сервер стартует и без них (отвечает 503 с подсказкой pip install),
  а `test_macro_server.py` подменяет их заглушками и проверяет логику (29 проверок: запись, F8/F9, toggle,
  repeat_count, валидация 422, занятость 409, отсутствие макроса 404).
- Сервер слушает только 127.0.0.1: он управляет мышью, поэтому наружу не отдаётся; CORS ограничен
  localhost-портами Vite (без credentials).
- Фронтенд: `src/macro/useMacro.ts` (опрос `/api/status` каждые 1,2 с, offline-состояние),
  `src/components/MacroPanel.tsx` (панель 🖱️), голосовые интенты «макрос/кликер» в commands.ts
  (включают запись, запуск с разбором числа повторов `parseRepeat`, остановку).
- На Windows-запуск: `backend/start_backend.bat` (venv + pip install + старт) — инструкция в
  `КАК-ЗАПУСТИТЬ-НА-WINDOWS.md` (пункт 7).

## Решения по «Мозгам» и «Магии утра» (этап 2)

- База привычек: SQLite запрещён правилом платформы, поэтому схема спроектирована под
  PostgreSQL через `DATABASE_URL` (backend/db.py, DDL в PG_DDL, драйвер psycopg — ленивый импорт);
  без DATABASE_URL работает постоянный JSON-файл backend/data/habits.json — данные сохраняются,
  а на ПК пользователя не нужно ставить СУБД. Таблицы: habits (id, title, icon, created_at,
  sort_order, archived, best_streak) и habit_logs (habit_id, day, status done|skipped, marked_at,
  PK (habit_id, day)). Стрик не хранится, а вычисляется: подряд идущие 'done'-дни, заканчивающиеся
  сегодня или вчера; best_streak (рекорд) обновляется при отметках.
- LLM (backend/llm.py): провайдер по env (OpenAI-совместимый → Gemini → офлайн-характер).
  Системный промпт — дословно характер из запроса пользователя (заработок через Mini Apps/
  инвестиции/курьерство, мотивация, любознательный вопрос раз в 3–4 сообщения — для LLM через
  счётчик в nudge, для офлайна — детерминированно каждое 4-е). Сбой провайдера = честный
  переход на офлайн-характер (source=offline-error), ассистент отвечает всегда.
- Безопасность (backend/tg_auth.py): официальный алгоритм проверки initData
  (HMAC SHA-256, секрет WebAppData, data_check_string), контроль возраста auth_date (24 ч)
  и белого списка KOLOBOK_ALLOWED_TG_IDS. Включается только с KOLOBOK_TG_BOT_TOKEN — локальный
  режим не ломает. Фронтенд шлёт заголовок X-TG-Init-Data автоматически (src/api/client.ts).
- Фронтенд: вкладки 🌙/✨/💬 (framer-motion AnimatePresence), глубинные ссылки ?tab=morning|chat;
  стеклянные панели (.glass), кристаллы-привычки с золотым свечением при выполнении (.habit.done),
  «цепочка звёзд» за 7 дней, мотивация после полного чек-листа; чат — пузырьки, typing-dots,
  быстрые вопросы, микрофон (useRecognition), озвучка ответов (useSpeech), индикатор связи.
- Telegram Mini App: telegram-web-app.js в index.html, src/tma.ts (ready/expand), полная инструкция
  по туннелям (Cloudflare/ngrok), BotFather и деплою (Vercel/GitHub Pages) — TELEGRAM-MINI-APP.md.
- Реалтайм-WebSocket отложен как следующий шаг: текущие HTTP-эндпоинты уже работают удалённо
  через туннель, статусы видны по индикаторам; WS даст мгновенные пуш-статусы воспроизведения.

## Статус

- [x] Каркас проекта, движок команд, речь, дизайн-сцена, PWA.
- [x] Исправлены два дефекта движка: «через час» в напоминаниях и определение города для погоды.
- [x] `tsc --noEmit` чисто, engine-smoke (18 команд + 7 погодных) OK, SSR-рендер OK, `npm run build` OK.
- [x] Production-сборка и dev-сервер проверены агентом (HTTP + скриншот).
- [x] Исправлен HTTP 403 при открытии через прокси Promto: Vite 5.4 блокировал внешний Host —
  в `vite.config.ts` добавлено `server.allowedHosts: true` и `preview.allowedHosts: true`;
  после перезапуска dev-сервера внешний Host отвечает 200, скриншот интерфейса чистый.
- [x] Service-worker защищён от «залипания» ошибочных страниц: кэш поднят до `kolobok-v2`
  (старый удаляется при activate), кэшируются только `res.ok && type === 'basic'`,
  навигация — network-first с офлайн-fallbackом из кэша.
- [x] Консольная ошибка `Cannot redefine property: ethereum (evmAsk.js)` исходит из
  браузерного расширения (crypto-кошелёк), в коде приложения `ethereum`/`defineProperty` отсутствуют.
- [x] Автокликер (макрос-рекордер): Python-бэкенд `backend/macro_server.py` (FastAPI, pynput, pyautogui),
  панель 🖱️ во фронтенде, голосовые команды. Проверено агентом в sandbox: `test_macro_server.py` —
  29/29 OK; engine-smoke (22 команды + 4 макрос-кейса + 7 погодных) OK; tsc, SSR (с кнопкой 🖱️),
  `npm run build` OK; dev-сервер 5175 HTTP 200; скриншот `/?macro` — панель рендерится, при незапущенном
  бэкенде показывает инструкцию и блокирует кнопки. Реальная запись/воспроизведение мыши возможны только
  на машине пользователя (Windows) — в sandbox нет экрана и мыши.
- [x] Этап 2: «Мозги» (LLM-чат) + «Магия утра» (привычки/стрики) + TMA-интеграция + вкладки.
  Проверено агентом в sandbox: backend-тесты 38/38 (CRUD привычек, стрики по реальным датам,
  валидация 422/404, мотивация при all_done, офлайн-LLM с вопросом на 4-е сообщение, initData HMAC:
  валидная/чужой ID/подделанная подпись/просроченная — 403; регресс макрос-тестов 29/29 OK);
  tsc чисто, engine-smoke OK, SSR OK (вкладки на месте), npm run build OK (332 КБ JS);
  бэкенд запущен в sandbox на 8765, фронтенд на 5175 — интеграция через Vite-прокси /backend-api
  проверена curl (status, habits, POST привычек, отметки, чат) и скриншотами promto_preview:
  «✨ Магия утра» (кристаллы, золотое свечение выполненной привычки, стрик 2, форма AddHabit)
  и «💬 Чат» (стеклянная панель, индикатор «на связи», быстрые вопросы) рендерятся корректно.
  LLM с реальным ключом и клиент Telegram проверяются только у пользователя (ключей и TG-сессии
  в sandbox нет); офлайн-режим без ключей проверен полностью.

## Git / GitHub

- В папке проекта создан отдельный репозиторий (ветка `main`), первый коммит `a5466f7` со всеми файлами проекта.
- Remote `origin` указывает на `https://github.com/DmitriyDzhambek/kolobok-assistant.git`
  (фактически через git-прокси Promto: `https://api.promto.ai/api/git-proxy/github/...`).
- Push ВЫПОЛНЕН и проверен: пользователь авторизовал OAuth-приложение Promto на GitHub (settings/connections),
  после чего в sandbox стала доступна `GITHUB_TOKEN` (владелец DmitriyDzhambek, push: true).
  Репозиторий `DmitriyDzhambek/kolobok-assistant` был создан пользователем с auto-README (commit 186c961);
  история смержена `git merge --allow-unrelated-histories -X ours gh/main` (наш README сохранён),
  запушен merge-commit `4aaacdf` (ветка `main`). Проверено публичным API GitHub: 26 файлов, HEAD main = 4aaacdf.
  Особенность: глобальный git-config платформы переписывает github.com-remote на git-прокси (который для этого
  репозитория отвечает 404), поэтому push/fetch выполняются явным URL с `x-access-token:$GITHUB_TOKEN`.
  Токен в .git/config не оставлен. Пользователь клонирует проект обычной командой:
  `git clone https://github.com/DmitriyDzhambek/kolobok-assistant.git`
- [ ] Публикация по HTTPS — выполняется агентом после проверки превью.
- [ ] Голос (микрофон и озвучка) проверяется только в браузере пользователя: Web Speech API требует
  HTTPS (или localhost) и Chrome/Edge; в серверном скриншоте недоступен.
