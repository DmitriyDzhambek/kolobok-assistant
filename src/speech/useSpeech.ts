import { useEffect, useRef } from "react";

export function useSpeech(
	muted: boolean,
	onState: (speaking: "speak" | null) => void,
) {
	const mutedRef = useRef(muted);
	mutedRef.current = muted;
	const onStateRef = useRef(onState);
	onStateRef.current = onState;
	const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

	useEffect(() => {
		if (!("speechSynthesis" in window)) return;
		const pick = () => {
			const voices = window.speechSynthesis.getVoices();
			voiceRef.current =
				voices.find(
					(v) =>
						v.lang?.toLowerCase().startsWith("ru") && /google/i.test(v.name),
				) ||
				voices.find((v) => v.lang?.toLowerCase().startsWith("ru")) ||
				null;
		};
		pick();
		window.speechSynthesis.addEventListener("voiceschanged", pick);
		return () =>
			window.speechSynthesis.removeEventListener("voiceschanged", pick);
	}, []);

	const speak = (text: string) => {
		if (!("speechSynthesis" in window)) return;
		window.speechSynthesis.cancel();
		if (mutedRef.current || !text) {
			onStateRef.current(null);
			return;
		}
		const u = new SpeechSynthesisUtterance(text);
		u.lang = "ru-RU";
		if (voiceRef.current) u.voice = voiceRef.current;
		u.rate = 1.05;
		u.pitch = 1.15;
		u.volume = 1;
		u.onstart = () => onStateRef.current("speak");
		u.onend = () => onStateRef.current(null);
		u.onerror = () => onStateRef.current(null);
		window.speechSynthesis.speak(u);
	};

	const stop = () => {
		if ("speechSynthesis" in window) window.speechSynthesis.cancel();
	};

	return {
		speak,
		stop,
		supported: typeof window !== "undefined" && "speechSynthesis" in window,
	};
}
