# Колобок как Telegram Mini App: туннель, бот и деплой

Цель: открывать Колобка прямо из Telegram (кнопка бота или меню ☰ → Mini App)
и удалённо управлять своим ПК — макросами, привычками («Магия утра») и чатом.

Архитектура:

```
Telegram (телефон/ПК)
   │  открывает Mini App (HTTPS-ссылка на фронтенд)
   ▼
Фронтенд (GitHub Pages / Vercel, HTTPS)
   │  fetch / WebSocket → https://<твой-домен>/api/...
   ▼
Cloudflare Tunnel (cloudflared) или ngrok  — HTTPS → localhost
   ▼
Python-бэкенд на твоём ПК (http://127.0.0.1:8765)
   └── управляет мышью (pyautogui/pynput), привычками и LLM-чатом
```

Telegram требует HTTPS и для Mini App, и для API-запросов из него — поэтому
локальный бэкенд публикуется через туннель.

## 1. Безопасность (сделать ОБЯЗАТЕЛЬНО до публикации туннеля)

Бэкенд управляет твоим компьютером. Чтобы командами мог пользоваться только ты:

1. Узнай свой Telegram ID: напиши боту @userinfobot (например, `123456789`).
2. Создай бота у @BotFather: `/newbot` → получишь токен вида `777...:AAF...`.
3. Задай переменные окружения бэкенду (в PowerShell перед запуском):

```powershell
$env:KOLOBOK_TG_BOT_TOKEN = "ТОКЕН_БОТА"          # никогда не коммить!
$env:KOLOBOK_ALLOWED_TG_IDS = "123456789"          # твой ID (можно несколько через запятую)
python backend\macro_server.py
```

Теперь любой запрос без валидного `initData` Telegram (заголовок `X-TG-Init-Data`,
который фронтенд отправляет автоматически) получит `403`. Подпись проверяется
по официальному алгоритму HMAC-SHA256 с секретом `WebAppData` (backend/tg_auth.py),
плюс проверяется свежесть `auth_date` и вхождение ID в белый список.

Без этих переменных сервер остаётся в локальном режиме (только 127.0.0.1, без
проверки) — так он работает «из коробки» на твоём ПК.

## 2. Туннель: Cloudflare (рекомендуется, бесплатно, HTTPS из коробки)

### Быстрый вариант (временная ссылка, без аккаунта)

1. Скачай `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Запусти бэкенд (`backend\start_backend.bat`).
3. В отдельном окне:

```powershell
cloudflared tunnel --url http://127.0.0.1:8765
```

4. В консоли появится адрес вида `https://random-words-1234.trycloudflare.com` —
   это твой публичный HTTPS-адрес бэкенда (живёт, пока открыто окно).
5. Фронтенду скажи, где бэкенд: собери его с переменной

```powershell
$env:VITE_MACRO_API_URL = "https://random-words-1234.trycloudflare.com"
npm run build
```

### Постоянный вариант (свой поддомен, аккаунт Cloudflare)

```powershell
cloudflared tunnel login
cloudflared tunnel create kolobok
cloudflared tunnel route dns kolobok kolobok.твой-домен.com
```

Создай `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: kolobok
credentials-file: C:\Users\ТВОЁ_ИМЯ\.cloudflared\KOLOBOK-UUID.json

ingress:
  - hostname: kolobok.твой-домен.com
    service: http://127.0.0.1:8765
  - service: http_status:404
```

Запуск: `cloudflared tunnel run kolobok` (или установи как службу Windows:
`cloudflared service install`).

### Альтернатива: ngrok

```powershell
ngrok http 8765
```

Даёт `https://xxxx.ngrok-free.app`. Учти: бесплатный ngrok показывает
предупреждающую страницу-заглушку для браузеров — для fetch-запросов обычно
мешает заголовок `ngrok-skip-browser-warning`; Cloudflare в этом плане проще.

## 3. Бот и привязка Mini App (@BotFather)

1. Задеплой фронтенд (пункт 4) и получи HTTPS-ссылку на приложение.
2. У @BotFather: `/mybots` → твой бот → **Bot Settings → Menu Button →
   Configure Menu Button** → укажи ссылку на фронтенд и подпись (например,
   «Колобок»). Готово: в чате с ботом появится кнопка, открывающая Mini App.
3. Либо создай полноценное Mini App: `/newapp` → выбери бота → загрузи
   иконку/описание → укажи ту же HTTPS-ссылку.

Внутри Telegram фронтенд автоматически вызывает `Telegram.WebApp.ready()` и
`expand()` (src/tma.ts) и добавляет `initData` к каждому запросу (src/api/client.ts).

Важно: быстрый туннель trycloudflare каждый раз даёт НОВЫЙ адрес — после перезапуска
`cloudflared` пересобери фронтенд с новым `VITE_MACRO_API_URL` (или используй
постоянный именованный туннель со своим доменом).

## 4. Деплой фронтенда

Сборка: `npm run build` → статическая папка `dist/`.

### Вариант A: Vercel (проще всего)

1. Залей проект на GitHub (уже сделано: DmitriyDzhambek/kolobok-assistant).
2. https://vercel.com/new → Import Git Repository → выбери репозиторий.
3. Framework: Vite (определится сам), Build: `npm run build`, Output: `dist`.
4. В **Environment Variables** добавь `VITE_MACRO_API_URL` = адрес твоего туннеля.
5. Deploy → получишь `https://kolobok-assistant.vercel.app` — её и даёшь BotFather.

### Вариант B: GitHub Pages (бесплатно, без сторонних сервисов)

1. В `vite.config.ts` при сборке для Pages нужен `base: "/kolobok-assistant/"`.
2. Собери: `npm run build`, загрузи содержимое `dist/` в ветку `gh-pages`
   (или используй action `peaceiris/actions-gh-pages`).
3. В настройках репозитория: Settings → Pages → источник: ветка `gh-pages`.
4. Адрес: `https://dmitriydzhambek.github.io/kolobok-assistant/`.

## 5. Чек-лист запуска «на утром»

- [ ] На ПК: `backend\start_backend.bat` (окно не закрывать);
- [ ] Заданы `KOLOBOK_TG_BOT_TOKEN` и `KOLOBOK_ALLOWED_TG_IDS`;
- [ ] Туннель запущен, HTTPS-адрес бэкенда известен;
- [ ] Фронтенд собран с `VITE_MACRO_API_URL` = адрес туннеля и задеплоен;
- [ ] Ссылка на фронтенд привязана к боту через @BotFather;
- [ ] Открыл Mini App из Telegram → вкладка 💬 показывает «на связи».

## 6. Ограничения и честные предупреждения

- Голосовой ввод (Web Speech API) внутри Telegram на Android работает не во всех
  версиях WebView — текстовый чат и кнопки работают всегда; на десктопе Telegram
  микрофон обычно доступен.
- Компьютер должен быть включён, а бэкенд и туннель — запущены: Mini App
  управляет ПК только пока они на связи (индикатор «на связи/офлайн» в чате).
- Публичный туннель к бэкенду, управляющему мышью, — серьёзная поверхность атаки.
  Держи белый список ID включённым, не отключай HTTPS и не публикуй токен бота.
- Автоматизация кликов в играх с античитом может нарушать правила этих игр.
