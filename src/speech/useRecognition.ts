import { useEffect, useMemo, useRef, useState } from "react";

type Opts = {
	onFinal: (text: string) => void;
	onInterim: (text: string) => void;
	onListening: (listening: boolean) => void;
	onError: (code: string) => void;
};

export function useRecognition(opts: Opts) {
	const optsRef = useRef(opts);
	optsRef.current = opts;
	const recRef = useRef<any>(null);
	const listeningRef = useRef(false);
	const [listening, setListening] = useState(false);

	const supported = useMemo(() => {
		if (typeof window === "undefined") return false;
		const w = window as any;
		return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
	}, []);

	useEffect(
		() => () => {
			try {
				recRef.current?.abort?.();
			} catch {
				/* noop */
			}
		},
		[],
	);

	const setListen = (b: boolean) => {
		listeningRef.current = b;
		setListening(b);
		optsRef.current.onListening(b);
	};

	const start = () => {
		if (!supported || listeningRef.current) return;
		const w = window as any;
		const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
		const rec = new Rec();
		rec.lang = "ru-RU";
		rec.continuous = true;
		rec.interimResults = true;
		rec.maxAlternatives = 1;
		rec.onstart = () => setListen(true);
		rec.onresult = (e: any) => {
			let interim = "";
			for (let i = e.resultIndex; i < e.results.length; i++) {
				const r = e.results[i];
				const t = r[0]?.transcript ?? "";
				if (r.isFinal) {
					const clean = String(t).trim();
					if (clean) optsRef.current.onFinal(clean);
				} else {
					interim += t;
				}
			}
			optsRef.current.onInterim(interim.trim());
		};
		rec.onerror = (e: any) => {
			const code = e?.error ?? "unknown";
			if (code !== "no-speech" && code !== "aborted")
				optsRef.current.onError(code);
		};
		rec.onend = () => {
			optsRef.current.onInterim("");
			setListen(false);
			recRef.current = null;
		};
		recRef.current = rec;
		try {
			rec.start();
		} catch {
			/* already started */
		}
	};

	const stop = () => {
		try {
			recRef.current?.stop();
		} catch {
			/* noop */
		}
	};

	return { supported, listening, start, stop };
}
