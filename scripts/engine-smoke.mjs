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

const cases = [
	"открой ютуб",
	"найди рецепт борща",
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
const weatherOk = weatherChecked === 0 || weatherFail === 0;

if (!chipOk) console.log("FAIL: chips", JSON.stringify(chips));
if (!taskOk) console.log("FAIL: tasks", JSON.stringify(tasks));
if (!weatherOk)
	console.log("FAIL: weather", weatherFail + "/" + weatherChecked);
console.log(
	chipOk && taskOk && weatherOk
		? `ENGINE SMOKE OK (weather checked: ${weatherChecked})`
		: "ENGINE SMOKE FAILED",
);
