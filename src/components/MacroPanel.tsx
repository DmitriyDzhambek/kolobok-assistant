import { useState } from "react";
import type { MacroCtl, MacroStatus } from "../macro/useMacro";

const STATE_TXT: Record<string, string> = {
	offline: "Бэкенд не запущен",
	idle: "Готов к записи",
	recording: "Идёт запись… стоп: F8 или ESC",
	stopping: "Останавливаю запись…",
	playing: "Кручу макрос… стоп: F9",
};

export function MacroPanel({
	status,
	lastError,
	ctl,
}: {
	status: MacroStatus;
	lastError: string | null;
	ctl: MacroCtl;
}) {
	const [repeat, setRepeat] = useState(1);
	const busyRec = status.state === "recording" || status.state === "stopping";
	const busyPlay = status.state === "playing";
	const offline = status.state === "offline";
	const disabledAll = offline || busyRec || busyPlay;

	return (
		<div className="macro-panel" aria-label="Автокликер: запись и повтор макросов">
			<div className="macro-head">
				<span className="macro-ico" aria-hidden>🖱️</span>
				<b>Автокликер-макрос</b>
				<span className={`macro-dot st-${status.state}`} aria-hidden />
				<span className="macro-state">
					{STATE_TXT[status.state] ?? status.state}
				</span>
			</div>

			{status.macro ? (
				<div className="macro-info">
					В макросе: {status.macro.events} событий ·{" "}
					{Math.max(1, Math.round(status.macro.duration_ms / 1000))} с
					{status.macro.screen
						? ` · экран ${status.macro.screen.w}×${status.macro.screen.h}`
						: ""}
				</div>
			) : offline ? (
				<div className="macro-info macro-warn">
					Запустите бэкенд на компьютере: <code>python backend/macro_server.py</code>{" "}
					(или двойной клик по <code>backend\start_backend.bat</code>) — инструкция в{" "}
					КАК-ЗАПУСТИТЬ-НА-WINDOWS.md
				</div>
			) : (
				<div className="macro-info">Макрос ещё не записан</div>
			)}

			{(lastError || status.error) && (
				<div className="macro-info macro-err">{lastError ?? status.error}</div>
			)}

			<div className="macro-row">
				<button
					className={`macro-btn rec ${busyRec ? "on" : ""}`}
					disabled={busyPlay || offline}
					onClick={() => void ctl.toggleRecord()}
					title="Записать движения мыши, клики и паузы; остановка — F8 или ESC"
				>
					{busyRec ? "■ Остановить запись (F8)" : "● Записать макрос"}
				</button>
			</div>

			<div className="macro-row">
				<label className="macro-label">
					Повторов:
					<input
						type="number"
						min={1}
						max={10000}
						value={repeat}
						onChange={(e) =>
							setRepeat(
								Math.max(1, Math.min(10000, Number(e.target.value) || 1)),
							)
						}
					/>
				</label>
				<button
					className={`macro-btn play ${busyPlay ? "on" : ""}`}
					disabled={disabledAll || (!busyPlay && !status.macro)}
					onClick={() =>
						busyPlay ? void ctl.stop() : void ctl.play(repeat)
					}
					title="Воспроизвести макрос N раз; экстренный стоп — F9 или мышь в левый верхний угол экрана"
				>
					{busyPlay ? "■ Остановить (F9)" : "▶ Запустить"}
				</button>
			</div>
		</div>
	);
}
