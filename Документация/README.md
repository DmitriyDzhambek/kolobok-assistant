# Документация проекта «Колобок»

## Бриф

Пользователь просил голосового помощника для рабочего стола Windows 10: ему говорят задачу голосом —
помощник помогает выполнить. Образ — Колобок из сказки (богатырский сказочный стиль), дизайн волшебный
и интересный. Название: «Ты отдыхай, а я для тебя заработаю». Требуется сразу рабочая версия.
Референс из чата: виджет с push-to-talk микрофоном (нажать — говорить, удерживать/пробел — диктовка,
отпустить — отправить) и подсказками о доступе к микрофону в Windows.

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

# Бэкенд автокликера (тесты работают без pynput/pyautogui — заглушки внутри):
python3 backend/test_macro_server.py
# Реальный запуск (на машине с мышью/экраном, Windows):
cd backend && start_backend.bat   # или: pip install -r requirements.txt && python macro_server.py
```

## Переменные окружения

Секретов нет (внешние сервисы без ключей: open-meteo). Необязательные:

- `VITE_MACRO_API_URL` — адрес бэкенда макросов для фронтенда (по умолчанию `http://localhost:8765`);
- `KOLOBOK_MACRO_PORT` — порт сервера макросов (по умолчанию 8765);
- `KOLOBOK_MACRO_ORIGINS` — дополнительные CORS-origins через запятую
  (по умолчанию разрешены localhost/127.0.0.1 порты 4173, 5173–5175).

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
