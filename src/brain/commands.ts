export type TaskItem = { id: string; text: string; done: boolean };
export type Link = { url: string; label: string };
export type Ctx = {
	tasks: TaskItem[];
	addTask: (text: string) => void;
	completeTask: (match?: string) => string | null;
	clearTasks: () => void;
	pushChip: (kind: "timer" | "reminder", text: string, ms: number) => void;
};
export type CommandResult = { reply: string; link?: Link };

const WORDS: Record<string, number> = {
	один: 1,
	одна: 1,
	одну: 1,
	два: 2,
	две: 2,
	три: 3,
	четыре: 4,
	пять: 5,
	шесть: 6,
	семь: 7,
	восемь: 8,
	девять: 9,
	десять: 10,
	одиннадцать: 11,
	двенадцать: 12,
	пятнадцать: 15,
	двадцать: 20,
	тридцать: 30,
	сорок: 40,
	пятьдесят: 50,
};

const SITES: Record<string, string> = {
	ютуб: "https://www.youtube.com",
	youtube: "https://www.youtube.com",
	яндекс: "https://ya.ru",
	yandex: "https://ya.ru",
	гугл: "https://www.google.com",
	google: "https://www.google.com",
	почта: "https://mail.ru",
	mail: "https://mail.ru",
	gmail: "https://mail.google.com",
	вк: "https://vk.com",
	вконтакте: "https://vk.com",
	vk: "https://vk.com",
	телеграм: "https://web.telegram.org",
	telegram: "https://web.telegram.org",
	ватсап: "https://web.whatsapp.com",
	whatsapp: "https://web.whatsapp.com",
	гитхаб: "https://github.com",
	github: "https://github.com",
	озон: "https://www.ozon.ru",
	ozon: "https://www.ozon.ru",
	вайлдбериз: "https://www.wildberries.ru",
	wildberries: "https://www.wildberries.ru",
	переводчик: "https://translate.yandex.ru",
	translate: "https://translate.yandex.ru",
	карты: "https://yandex.ru/maps",
	maps: "https://yandex.ru/maps",
	новости: "https://yandex.ru/news",
};

const PROVERBS = [
	"Без труда не выловишь и рыбку из пруда.",
	"Дело мастера боится — а Колобок за него берётся!",
	"Слово — серебро, а молчание — золото.",
	"Семь раз отмерь — один раз отрежь.",
	"Утро вечера мудренее, а Колобок — обоих проворнее.",
];
const TALES = [
	"Жили-были дед да баба, наскребли муки и испекли колобка… А я от них укатился — и теперь у тебя на рабочем столе службу служу!",
	"В некотором царстве, в некотором государстве жил-был Колобок — богатырь настольный: мышей не гоняет, зёрна не клюёт, а задачи щёлкает как орехи!",
	"Катился Колобок по дорожке, катился — да и докатился до вашего рабочего стола. С тех пор и повелось: ты отдыхаешь — я зарабатываю!",
];
const JOKES = [
	"Почему Колобок — отличный менеджер? Потому что умеет раскатать любую задачу!",
	"Программист просит Колобка: «Спой песенку». Колобок: «Я Колобок, Колобок, я твой собранный билд без багов!»",
	"Мне сказали отдохнуть. Я отдыхал целых две минуты — соскучился. Лучше я для тебя заработаю!",
];

function norm(s: string): string {
	return s.toLowerCase().replace(/ё/g, "е").trim();
}

function parseDuration(rawInput: string): {
	ms: number;
	phrase: string;
} | null {
	// Важно: в JS `\b` не работает для кириллицы, поэтому границы — через lookaround.
	const raw = norm(rawInput);
	const half = raw.match(/(?<![а-яё0-9])пол\s*часа(?![а-яё])/);
	if (half) return { ms: 30 * 60000, phrase: half[0] };
	const num = "(?:\\d{1,3}|" + Object.keys(WORDS).join("|") + ")";
	const re = new RegExp(
		"(?<![а-яёa-z0-9])(" +
			num +
			"\\s*)?(минутку|секунд[ыу]?|сек|минут[ыу]?|мин|часик[аов]?|час[ыаов]?|суток|сутки|день|дн[ейяю])(?![а-яё])",
	);
	const m = raw.match(re);
	if (!m) return null;
	const rawNum = m[1]?.trim();
	const val = rawNum
		? /^\d+$/.test(rawNum)
			? parseInt(rawNum, 10)
			: WORDS[rawNum]
		: 1;
	if (!val) return null;
	const u = m[2];
	const ms = u.startsWith("сек")
		? val * 1000
		: u.startsWith("мин")
			? val * 60000
			: u.startsWith("час")
				? val * 3600000
				: val * 86400000;
	return { ms, phrase: m[0] };
}

function human(ms: number): string {
	const s = Math.round(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	const parts: string[] = [];
	if (h) parts.push(`${h} ${h === 1 ? "час" : h < 5 ? "часа" : "часов"}`);
	if (m) parts.push(`${m} ${m === 1 ? "минуту" : m < 5 ? "минуты" : "минут"}`);
	if (ss && !h)
		parts.push(`${ss} ${ss === 1 ? "секунду" : ss < 5 ? "секунды" : "секунд"}`);
	return parts.join(" ") || "0 секунд";
}

function safeEval(expr: string): number | null {
	const s = expr.replace(/,/g, ".").trim();
	if (!/^[0-9+\-*/().\s^%]+$/.test(s) || !/\d/.test(s)) return null;
	const js = s.replace(/\^/g, "**");
	try {
		const v = Function('"use strict";return (' + js + ")")();
		return typeof v === "number" && isFinite(v) ? v : null;
	} catch {
		return null;
	}
}

function weatherDesc(code: number): string {
	if (code === 0) return "ясно";
	if (code <= 2) return "переменная облачность";
	if (code === 3) return "пасмурно";
	if (code <= 48) return "туман";
	if (code <= 57) return "морось";
	if (code <= 67) return "дождь";
	if (code <= 77) return "снег";
	if (code <= 82) return "ливень";
	if (code <= 99) return "гроза";
	return "непогода";
}

// Разговорные и сокращённые названия городов → именительный падеж.
const CITY_ALIASES: [RegExp, string][] = [
	[/(?<![а-яё])(питер|петербург|спб)[а-яё]*(?![а-яё])/, "Санкт-Петербург"],
	[/нижн[а-яё]*\s+новгород[а-яё]*/, "Нижний Новгород"],
	[/(?<![а-яё])мск(?![а-яё])/, "Москва"],
	[/(?<![а-яё])екат[а-яё]*(?![а-яё])/, "Екатеринбург"],
	[/(?<![а-яё])нск(?![а-яё])/, "Новосибирск"],
	[/(?<![а-яё])владик[а-яё]*(?![а-яё])/, "Владивосток"],
	[/(?<![а-яё])ростов[а-яё]*(?![а-яё])/, "Ростов-на-Дону"],
];

function aliasCity(s: string): string | null {
	for (const [re, name] of CITY_ALIASES) if (re.test(s)) return name;
	return null;
}

// Варианты именительного падежа из предложного/дательного/родительного.
function caseVariants(w: string): string[] {
	const out: string[] = [];
	const add = (v: string) => {
		if (v && v.length >= 3 && !out.includes(v)) out.push(v);
	};
	if (/(ом|ем)$/.test(w)) add(w.slice(0, -2));
	if (w.endsWith("е")) {
		add(w.slice(0, -1));
		add(w.slice(0, -1) + "а");
		add(w.slice(0, -1) + "ь");
		add(w.slice(0, -1) + "й");
		add(w.slice(0, -1) + "о");
	}
	if (w.endsWith("и")) {
		add(w.slice(0, -1) + "ь");
		add(w.slice(0, -1));
		add(w.slice(0, -1) + "а");
		add(w.slice(0, -1) + "й");
		add(w.slice(0, -1) + "о");
		add(w.slice(0, -1) + "я");
	}
	if (w.endsWith("ы")) {
		add(w.slice(0, -1) + "а");
		add(w.slice(0, -1));
	}
	if (w.endsWith("у") || w.endsWith("ю")) {
		add(w.slice(0, -1));
		add(w.slice(0, -1) + "а");
		add(w.slice(0, -1) + "ь");
	}
	if (w.endsWith("я")) {
		add(w.slice(0, -1) + "ь");
		add(w.slice(0, -1) + "а");
	}
	if (w.endsWith("а")) {
		add(w.slice(0, -1) + "ь");
		add(w.slice(0, -1));
	}
	if (w.endsWith("ь")) {
		add(w.slice(0, -1));
		add(w.slice(0, -1) + "а");
	}
	return out;
}

// «нижнем» → «нижний», «старом» → «старый» для составных названий.
function nominativeHead(head: string): string {
	return head
		.split(/\s+/)
		.map((w) => {
			if (w.endsWith("ем") || w.endsWith("им")) return w.slice(0, -2) + "ий";
			if (w.endsWith("ом") || w.endsWith("ым")) return w.slice(0, -2) + "ый";
			return w;
		})
		.join(" ");
}

function cityCandidates(cityRaw: string): string[] {
	const base = cityRaw.trim();
	const out: string[] = [];
	const push = (v?: string | null) => {
		const t = (v ?? "").replace(/\s+/g, " ").trim();
		if (t.length >= 3 && !out.includes(t)) out.push(t);
	};
	push(aliasCity(base));
	push(base);
	for (const v of caseVariants(base)) push(v);
	if (base.includes(" ")) {
		const parts = base.split(/\s+/);
		const last = parts[parts.length - 1];
		const head = parts.slice(0, -1).join(" ");
		push(last);
		for (const v of caseVariants(last)) {
			push(v);
			push(head + " " + v);
			push(nominativeHead(head) + " " + v);
		}
		push(nominativeHead(base));
	}
	return out.slice(0, 8);
}

async function geocodeSearch(
	name: string,
	signal: AbortSignal,
): Promise<any[]> {
	const g = await fetch(
		`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=ru&format=json`,
		{ signal },
	);
	const gj = await g.json();
	return Array.isArray(gj?.results) ? gj.results : [];
}

function placeScore(p: any, query: string): number {
	const nm = norm(p?.name ?? "");
	const q = norm(query);
	if (!nm || !q) return -1;
	let s = 0;
	if (nm === q) s += 1000;
	else if (nm.startsWith(q) || q.startsWith(nm)) s += 500;
	else {
		let i = 0;
		while (i < Math.min(nm.length, q.length) && nm[i] === q[i]) i++;
		s += i >= 4 ? 100 + i * 10 : i * 5;
	}
	if ((p?.country_code ?? "").toUpperCase() === "RU") s += 60;
	const pop = Number(p?.population ?? 0);
	if (pop > 0) s += Math.min(50, Math.round(Math.log10(Math.max(10, pop)) * 8));
	return s;
}

async function resolvePlace(cityRaw: string, signal: AbortSignal) {
	let best: { place: any; score: number } | null = null;
	for (const c of cityCandidates(cityRaw)) {
		let results: any[] = [];
		try {
			results = await geocodeSearch(c, signal);
		} catch {
			continue;
		}
		for (const r of results) {
			const sc = placeScore(r, c);
			if (!best || sc > best.score) best = { place: r, score: sc };
		}
		if (best && best.score >= 900) break;
	}
	// Порог защищает от «Твери» → «Тверия, Израиль» и «Москве» → «Москверо, США».
	return best && best.score >= 400 ? best.place : null;
}

const WEATHER_STOP_WORDS = [
	"какая",
	"какой",
	"какую",
	"каково",
	"прогноз",
	"сейчас",
	"сегодня",
	"завтра",
	"вчера",
	"на улице",
	"за окном",
	"подскажи",
	"скажи",
	"узнай",
	"покажи",
	"пожалуйста",
	"мне",
	"там",
	"что",
	"как",
	"если",
	"есть",
];

const WEATHER_STOP_PREPS = new Set([
	"в",
	"во",
	"на",
	"у",
	"по",
	"из",
	"для",
	"с",
	"со",
	"к",
	"до",
	"о",
	"об",
	"про",
	"городе",
	"город",
	"городке",
	"а",
	"и",
	"ну",
]);

// «какая погода в нижнем новгороде» → «нижнем новгороде»
function extractCity(n: string): string {
	const stopRe = new RegExp(
		"(?<![а-яё])(" + WEATHER_STOP_WORDS.join("|") + ")(?![а-яё])",
		"g",
	);
	const s = n.replace(/погод[а-яё]*/g, " ").replace(stopRe, " ");
	const parts = s.split(/\s+/).filter(Boolean);
	let guard = 0;
	while (parts.length && WEATHER_STOP_PREPS.has(parts[0]) && guard++ < 5)
		parts.shift();
	while (
		parts.length > 1 &&
		WEATHER_STOP_PREPS.has(parts[parts.length - 1]) &&
		guard++ < 10
	)
		parts.pop();
	return parts.join(" ");
}

async function weatherIntent(cityRaw: string): Promise<string> {
	const city = cityRaw.trim() || "Москва";
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), 9000);
	try {
		const place = await resolvePlace(city, ctrl.signal);
		if (!place)
			return `Не нашёл такой город на карте волшебной… Проверь название, друже.`;
		const f = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m`,
			{ signal: ctrl.signal },
		);
		const fj = await f.json();
		const t = Math.round(fj?.current?.temperature_2m ?? NaN);
		const code = fj?.current?.weather_code ?? 0;
		const w = Math.round(fj?.current?.wind_speed_10m ?? 0);
		return `В городе ${place.name} сейчас ${t > 0 ? "+" : ""}${t}°, ${weatherDesc(code)}, ветер ${w} м/с. Одевайся по погоде — а обо всём остальном я позабочусь!`;
	} catch {
		return "Погодные духи сейчас молчат — интернет капризничает. Попробуй через минутку, друже.";
	} finally {
		clearTimeout(to);
	}
}

export async function runCommand(
	raw: string,
	ctx: Ctx,
): Promise<CommandResult> {
	const n = norm(raw)
		.replace(/[.!?]+$/g, "")
		.trim();

	if (/что ты умеешь|помощь|команды|справка|как пользоваться/.test(n)) {
		return {
			reply:
				"Вот моя волшебная грамота: «открой ютуб» — открою сайт; «найди рецепт борща» — поищу; «таймер на 10 минут» — засечку; «напомни позвонить маме через час» — напомню; «задача: сдать отчёт» — запишу в список; «список задач» — покажу; «посчитай 25 умножить на 4» — сосчитаю; «который час», «какое сегодня число», «погода в Твери» — отвечу; «расскажи сказку» — порадую. Ты отдыхай — а я для тебя заработаю!",
		};
	}

	if (/кто ты|как тебя зовут|представься/.test(n)) {
		return {
			reply:
				"Я — Колобок, богатырь твоего рабочего стола! Имя моё волшебное: «Ты отдыхай, а я для тебя заработаю». Ты говоришь — я делаю: открываю, ищу, считаю, напоминаю и слежу за задачами.",
		};
	}

	const folk = n.match(
		/^расскажи\s+(сказку|притчу|анекдот|шутку|поговорку|пословицу|историю|что-нибудь)/,
	);
	if (folk) {
		const kind = folk[1];
		if (
			kind.startsWith("сказ") ||
			kind.startsWith("прит") ||
			kind.startsWith("ист")
		) {
			return { reply: TALES[Math.floor(Math.random() * TALES.length)] };
		}
		if (kind.startsWith("погов") || kind.startsWith("посл")) {
			return {
				reply:
					"Вот моя любимая поговорка: " +
					PROVERBS[Math.floor(Math.random() * PROVERBS.length)],
			};
		}
		return { reply: JOKES[Math.floor(Math.random() * JOKES.length)] };
	}

	if (/таймер/.test(n)) {
		const d = parseDuration(n);
		if (!d)
			return {
				reply:
					"На сколько засечь таймер? Скажи, например: «таймер на 10 минут» или «таймер 30 секунд».",
			};
		ctx.pushChip("timer", "", d.ms);
		return {
			reply: `Волшебные пески засечены на ${human(d.ms)}. Сам тебя кликну, когда время придёт, — а ты отдыхай.`,
		};
	}

	if (/напомни/.test(n)) {
		const d = parseDuration(n);
		const dropLast = (s: string, frag: string) => {
			if (!frag) return s;
			const i = s.lastIndexOf(frag);
			return i < 0 ? s : s.slice(0, i) + s.slice(i + frag.length);
		};
		let text = dropLast(n.replace(/^.*напомни/, ""), d ? d.phrase : "")
			.replace(/\s+/g, " ")
			.replace(/\s*(через|спустя)\s*$/g, "")
			.replace(/^\s*(через|спустя)\s+/g, "")
			.replace(/^\s*(мне|о|об|про)\s+/, "")
			.trim();
		text = text.replace(/^[-–—:,\s]+/, "").trim();
		if (!d)
			return {
				reply: `Запомнил бы я «${text || "это"}» с радостью, только скажи: через сколько напомнить — минуты, часы?`,
			};
		ctx.pushChip("reminder", text, d.ms);
		return {
			reply: `Записал на волшебной бересте! Через ${human(d.ms)} напомню: «${text}». А ты отдыхай.`,
		};
	}

	if (/очисти (список )?задач|удали все задачи/.test(n)) {
		ctx.clearTasks();
		return {
			reply:
				"Список задач чист, как снег в чистом поле! Начнём с новой строки?",
		};
	}

	if (
		/список задач|мои задачи|что мне сделать|какие задачи|задачи есть/.test(n)
	) {
		const open = ctx.tasks.filter((t) => !t.done);
		if (!open.length)
			return {
				reply:
					"Список задач чист, как скатерть свежая. Скажи «задача: …» — и я запишу.",
			};
		return {
			reply:
				"Твои задачи, друже: " +
				open.map((t, i) => `${i + 1}) ${t.text}`).join("; ") +
				". Скажи «выполнено …» — и я зачеркну.",
		};
	}

	const done = n.match(
		/^(выполнено|сделано|сделал|зачеркни|отметь|заверши)\s*(.+)?$/,
	);
	if (done) {
		const finished = ctx.completeTask(done[2]?.trim() || undefined);
		if (!finished)
			return {
				reply:
					"Не нашёл такой задачи в списке. Скажи «список задач» — покажу, что там есть.",
			};
		return {
			reply: `Ура! Задача «${finished}» выполнена. Ты отдыхай, а я для тебя заработаю!`,
		};
	}

	const add = n.match(
		/^(задача[: ]*|запиши[: ]*|запомни[: ]*|добавь задачу[: ]*|добавь в список[: ]*|в список[: ]*|надо[: ]*|нужно[: ]*)+(.+)$/,
	);
	if (add) {
		const text = add[2].trim();
		ctx.addTask(text);
		return {
			reply: `Записал задачу: «${text}». Будет сделано — ты только отдыхай.`,
		};
	}

	const openSite = n.match(/^(открой|зайди на)\s+(.+)$/);
	if (openSite) {
		const name = openSite[2]
			.replace(/\s*(сайт|страницу|страница)\s*/g, "")
			.trim();
		const url =
			SITES[name] ||
			(name.includes(".") ? "https://" + name.replace(/\s+/g, "") : null);
		if (!url)
			return {
				reply: `Не знаю такой тропинки: «${name}». Назови сайт, например: «открой ютуб» или «открой yandex.ru».`,
			};
		const label = name.charAt(0).toUpperCase() + name.slice(1);
		return {
			reply: `Открываю волшебное окошко: ${label}! Жми на свиток ниже, если браузер спросит разрешения.`,
			link: { url, label: "Открыть: " + label },
		};
	}

	const search =
		n.match(/^(найди|поищи|погугли|загугли|посмотри)\s+(.+)$/) ||
		n.match(/^(что такое|кто такой|кто такая|расскажи про)\s+(.+)$/);
	if (search) {
		const q = search[2].trim();
		return {
			reply: `Сейчас гляну в волшебном зеркале всё про «${q}». Открой свиток — и поиск перед тобой!`,
			link: {
				url: "https://yandex.ru/search/?text=" + encodeURIComponent(q),
				label: "Искать: " + q,
			},
		};
	}

	const calc = n.match(/^(посчитай|вычисли|сколько будет|калькулятор)\s*(.+)$/);
	if (calc) {
		const expr = calc[2]
			.replace(/умножить на|умноженное на/g, "*")
			.replace(/плюс/g, "+")
			.replace(/минус/g, "-")
			.replace(/разделить на|деленное на/g, "/");
		const v = safeEval(expr);
		if (v === null)
			return {
				reply:
					"В моём счёте такое не складывается… Скажи проще, например: «посчитай 25*4+10».",
			};
		const rounded = Math.round(v * 1e6) / 1e6;
		return {
			reply: `Считано на волшебных счётах: ${expr.trim()} = ${rounded}.`,
		};
	}

	if (/который час|сколько времени|время сейчас|который сейчас час/.test(n)) {
		const t = new Date().toLocaleTimeString("ru-RU", {
			hour: "2-digit",
			minute: "2-digit",
		});
		return { reply: `По моим волшебным часам сейчас ${t}.` };
	}

	if (
		/какое сегодня число|какой сегодня день|сегодняшняя дата|какое число/.test(
			n,
		)
	) {
		const d = new Date().toLocaleDateString("ru-RU", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		});
		return { reply: `Сегодня ${d}. День добрый для добрых дел!` };
	}

	if (/погод/.test(n)) {
		const reply = await weatherIntent(extractCity(n));
		return { reply };
	}

	if (/устал|умотал|замучил|тяжело мне|хочу отдых|отдохнуть/.test(n)) {
		return {
			reply:
				"Ты отдыхай, а я для тебя заработаю! Приляг на печку, а я покараулю задачи, таймеры и напоминания — только диктуй.",
		};
	}

	if (/спасибо|благодарю|молодец/.test(n)) {
		return {
			reply: "Всегда пожалуйста! Я для того и испечён, чтобы тебе помогать.",
		};
	}

	if (/^(пока|до свидания|до встречи|спокойной ночи)/.test(n)) {
		return {
			reply: "До встречи, друже! Я останусь на дозоре — позови в любую минуту.",
		};
	}

	if (
		/^(привет|здравствуй|здорово|добрый день|добрый вечер|доброе утро|салют|хай)/.test(
			n,
		)
	) {
		return {
			reply:
				"Здравствуй, друже! Я уже качусь к делам на всех парах… то есть крошках. Какую задачу возьмём первой?",
		};
	}

	return {
		reply:
			"Хм, такой магии я ещё учусь… Я умею: открывать сайты, искать в интернете, ставить таймеры и напоминания, вести список задач, считать, говорить время, дату и погоду, рассказывать сказки. Скажи «помощь» — покажу всю грамоту!",
	};
}
