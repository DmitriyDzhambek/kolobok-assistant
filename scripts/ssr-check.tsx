import { renderToString } from "react-dom/server";
import App from "../src/App";

(globalThis as any).localStorage = {
	getItem: () => null,
	setItem: () => {},
};

const html = renderToString(<App />);
const checks: [string, boolean][] = [
	["title", html.includes("Ты отдыхай, а я для тебя заработаю")],
	["subtitle", html.includes("Колобок · сказочный голосовой богатырь")],
	["kolobok svg", html.includes('aria-label="Колобок — голосовой помощник"')],
	["bubble", html.includes("bubble-text")],
	["hint push-to-talk", html.includes("Нажмите — говорить")],
	["toolbar mic", html.includes("tb mic")],
	["toolbar macro button", html.includes("tb macro")],
	["nav tabs", html.includes("nav") && html.includes("Магия утра") && html.includes("💬 Чат")],
	["background stars", html.includes("star")],
	["forest", html.includes("forest")],
];
let fail = 0;
for (const [name, ok] of checks) {
	if (!ok) fail++;
	console.log((ok ? "OK  " : "FAIL") + " " + name);
}
console.log(
	fail === 0
		? "SSR RENDER OK, html length=" + html.length
		: "SSR RENDER FAILED",
);
