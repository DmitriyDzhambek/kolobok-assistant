import { runCommand } from "../src/brain/commands";

const chips = [];
const tasks = [];
const ctx = {
	tasks,
	addTask: (t) => tasks.push({ id: "x" + tasks.length, text: t, done: false }),
	completeTask: (m) => {
		const open = tasks.filter((x) => !x.done);
		const nm = (s) => s.toLowerCase().replace(/ё/g, "е");
		const target = m ? open.find((x) => nm(x.text).includes(nm(m))) : open[0];
		if (!target) return null;
		target.done = true;
		return target.text;
	},
	clearTasks: () => (tasks.length = 0),
	pushChip: (kind, text, ms) => chips.push({ kind, text, ms }),
};

// Фейковый макрос-контроллер: проверяем, что движок дёргает нужные методы.
const macroLog = [];
ctx.macro = {
	state: () => "idle",
	toggleRecord: async () => {
		macroLog.push("record");
		return null;
	},
	play: async (r) => {
		macroLog.push("play:" + r);
		return null;
	},
	stop: async () => {
		macroLog.push("stop");
		return null;
	},
};

const cases = [
	"открой ютуб",
	"найди рецепт борща",
	"рецепт оливье",
	"как приготовить плов",
	"покажи рецепты",
	"что приготовить",
	"таймер на 5 минут",
	"таймер через полчаса",
	"напомни позвонить маме через час",
	"напомни через 2 часа выпить воды",
	"задача: сдать отчёт",
	"список задач",
	"выполнено отчёт",
	"посчитай 25*4+10",
	"который час",
	"какое сегодня число",
	"расскажи сказку",
	"расскажи шутку",
	"кто ты",
	"записать макрос",
	"запиши макрос",
	"запусти макрос 10 раз",
	"останови макрос",
	"помощь",
	"я устал",
	"абракадабра бревис",
];

for (const c of cases) {
	const r = await runCommand(c, ctx);
	console.log(
		"— " +
			c +
			"\n  → " +
			r.reply.slice(0, 110) +
			(r.link ? " | link: " + r.link.url : ""),
	);
}

// Рецепты должны открываться внутри Колобка, а не ссылкой в браузер.
const recipeCases = [
	["найди рецепт борща", "borsch"],
	["рецепт оливье", "olivier"],
	["как приготовить плов", "plov"],
	["покажи сырники", "syrniki"],
	["покажи рецепты", null],
	["что приготовить", null],
];
let recipeFail = 0;
for (const [q, id] of recipeCases) {
	const r = await runCommand(q, ctx);
	const ok = !!r.recipe && !r.link && (id ? r.recipe.id === id : !r.recipe.id);
	if (!ok) recipeFail++;
	console.log(
		(ok ? "— " : "✗ ") +
			q +
			"\n  → " +
			(r.recipe ? JSON.stringify(r.recipe) : "NO RECIPE") +
			" | " +
			r.reply.slice(0, 90),
	);
}

// Погода требует сети: проверяем, что возвращается именно запрошенный город.
const weatherCases = [
	["погода в Твери", ["Тверь"]],
	["погода в Москве", ["Москва"]],
	["какая погода в Питере", ["Санкт-Петербург"]],
	["погода в Санкт-Петербурге", ["Санкт-Петербург"]],
	["погода в Нижнем Новгороде", ["Нижний Новгород"]],
	["погода в Тамбове", ["Тамбов"]],
	["погода", ["Москва"]],
];
let weatherChecked = 0;
let weatherFail = 0;
for (const [q, expect] of weatherCases) {
	const r = await runCommand(q, ctx);
	const offline = /интернет капризничает/.test(r.reply);
	if (offline) {
		console.log("— " + q + "\n  → SKIP (нет сети): " + r.reply.slice(0, 80));
		continue;
	}
	weatherChecked++;
	const ok = expect.some((e) => r.reply.includes(e)) && /°/.test(r.reply);
	if (!ok) weatherFail++;
	console.log((ok ? "— " : "✗ ") + q + "\n  → " + r.reply.slice(0, 110));
}

console.log("chips:", JSON.stringify(chips));
console.log("tasks after flow:", JSON.stringify(tasks));

const chipOk =
	chips.length === 4 &&
	chips[0].kind === "timer" &&
	chips[0].ms === 300000 &&
	chips[1].kind === "timer" &&
	chips[1].ms === 1800000 &&
	chips[2].kind === "reminder" &&
	/позвонить маме/.test(chips[2].text) &&
	chips[2].ms === 3600000 &&
	chips[3].kind === "reminder" &&
	/выпить воды/.test(chips[3].text) &&
	chips[3].ms === 7200000;
const taskOk = tasks.length === 1 && tasks[0].done === true;
const macroOk =
	macroLog.join(",") === "record,record,play:10,stop" && tasks.length === 1;
const weatherOk = weatherChecked === 0 || weatherFail === 0;

if (!chipOk) console.log("FAIL: chips", JSON.stringify(chips));
if (!taskOk) console.log("FAIL: tasks", JSON.stringify(tasks));
if (!macroOk)
	console.log("FAIL: macro", JSON.stringify(macroLog), "tasks:", tasks.length);
if (!weatherOk)
	console.log("FAIL: weather", weatherFail + "/" + weatherChecked);
if (recipeFail) console.log("FAIL: recipes", recipeFail);
console.log(
	chipOk && taskOk && macroOk && weatherOk && recipeFail === 0
		? `ENGINE SMOKE OK (weather checked: ${weatherChecked}, recipes ok)`
		: "ENGINE SMOKE FAILED",
);
