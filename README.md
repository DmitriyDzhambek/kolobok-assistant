# Колобок — «Ты отдыхай, а я для тебя заработаю»

Сказочный голосовой помощник для рабочего стола Windows 10: пользователь говорит задачу голосом —
Колобок выполняет её и отвечает голосом. Образ — Колобок из русской сказки в стиле богатырской
сказочной магии: ночное небо, звёзды, светлячки, еловый лес, золотая орнаментальная рамка.

## Команды запуска

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5175   # dev-сервер
npm run build                                # production-сборка в dist/
npm run preview -- --host 0.0.0.0 --port 4173
node scripts/make-icons.mjs                  # перегенерация PNG-иконок PWA

# Автокликер (Python-бэкенд, только на машине с мышью/экраном, например Windows):
cd backend && python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
python macro_server.py                        # http://127.0.0.1:8765 (или backend\start_backend.bat)
python test_macro_server.py                   # тесты логики бэкенда (pynput/pyautogui не нужны)
```

## Что умеет (рабочая версия)

- Голосовой ввод ru-RU (Web Speech API): нажать — говорить, удерживать (или пробел) — диктовка, отпустить — отправить.
- Голосовой ответ Колобка (speechSynthesis, русский голос), тихий режим.
- Команды: открыть сайт, поиск в интернете, таймер, напоминание, список задач (localStorage),
  счёт, время, дата, погода (open-meteo, без ключей), сказки/шутки/пословицы, справка.
- PWA: manifest + service worker → установка на рабочий стол Windows 10 как приложение (Chrome: меню → «Установить…»).
- Автозапуск на Windows: ярлык установленного приложения положить в Win+R → shell:startup.
- Автокликер (макрос-рекордер для игрового контента, Python-бэкенд): запись движений мыши, кликов,
  скроллов и пауз (стоп — F8/ESC), воспроизведение с repeat_count (стоп — F9 или failsafe-угол экрана),
  кнопка 🖱️ на панели и голосовые команды «записать макрос», «запусти макрос 10 раз», «останови макрос».

## Стек

Vite + React + TypeScript; вся основная логика на клиенте (Web Speech API, localStorage, open-meteo API).
Опциональный локальный бэкенд автокликера: Python + FastAPI + pynput (запись) + pyautogui (воспроизведение),
только на 127.0.0.1:8765, CORS для localhost-портов Vite; макрос хранится в `backend/macros/macro.json`.

## Структура

- `src/App.tsx` — сцена, состояние помощника, push-to-talk, чипы задач/таймеров, тулбар, помощь.
- `src/brain/commands.ts` — движок команд (интенты, таймеры, напоминания, погода, счёт, макросы).
- `src/speech/useRecognition.ts` / `useSpeech.ts` — распознавание и синтез речи.
- `src/macro/useMacro.ts` — клиент API бэкенда макросов + опрос статуса.
- `src/components/Kolobok.tsx` — анимированный SVG-Колобок (моргание, речь, аура слушания).
- `src/components/MacroPanel.tsx` — панель автокликера (запись, повторы, статус).
- `src/components/Background.tsx` — волшебная сцена (звёзды, луна, светлячки, лес, орнамент).
- `backend/macro_server.py` — FastAPI-сервер макрос-рекордера (`/api/record`, `/api/play`, `/api/status`).
- `backend/test_macro_server.py` — тесты бэкенда с заглушками pynput/pyautogui (29 проверок).
- `public/` — manifest, service worker, иконки.
