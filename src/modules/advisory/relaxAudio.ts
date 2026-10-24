/**
 * Advisory Mode — «Спокойный звук» (белый/коричневый шум через WebAudio).
 *
 * Используется Behavioral Shield для «заморозки паники»:
 * пользователь включает звук, убирает глаза от экрана, дышит 10 мин.
 *
 * Это Advisory Mode — никакие торговые действия не совершаются.
 */

export class RelaxAudio {
	private ctx: AudioContext | null = null;
	private gain: GainNode | null = null;
	private source: AudioBufferSourceNode | null = null;
	private _playing = false;

	get playing() {
		return this._playing;
	}

	/** Включить коричневый шум (мягче белого, лучше для релакса). */
	async start(): Promise<void> {
		if (this._playing) return;
		try {
			if (!this.ctx) {
				this.ctx = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext })
						.webkitAudioContext)();
			}
			if (this.ctx.state === "suspended") await this.ctx.resume();

			const bufferSize = 4 * 44100; // 4 сек буфер
			const buffer = this.ctx.createBuffer(1, bufferSize, 44100);
			const data = buffer.getChannelData(0);

			// Brown noise (в 2x сильнее attenuated по сравнению с white noise)
			let lastOut = 0;
			for (let i = 0; i < bufferSize; i++) {
				const white = Math.random() * 2 - 1;
				data[i] = (lastOut + 0.02 * white) / 1.02;
				lastOut = data[i];
				data[i] *= 3.5; // компенсация громкости
			}

			this.gain = this.ctx.createGain();
			this.gain.gain.value = 0.3;

			this.source = this.ctx.createBufferSource();
			this.source.buffer = buffer;
			this.source.loop = true;
			this.source.connect(this.gain);
			this.gain.connect(this.ctx.destination);
			this.source.start();

			this._playing = true;
		} catch {
			// Audio API недоступен — тихо пропускаем.
		}
	}

	/** Остановить шум. */
	stop(): void {
		try {
			this.source?.stop();
			this.source = null;
			this._playing = false;
		} catch {
			// ignore
		}
	}

	/** Тест — включить на 2 секунды для проверки. */
	async test(): Promise<void> {
		await this.start();
		setTimeout(() => this.stop(), 2000);
	}
}
