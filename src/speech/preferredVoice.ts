const feminineVoiceNames =
  /\b(irina|milena|alena|alyona|elena|svetlana|olga|natalia|natalya|anna|maria|mariya|katya|ekaterina|female)\b/i;
const naturalVoiceNames = /\b(natural|neural|online|premium|google|yandex)\b/i;

export function getPreferredSpeechVoice(
  voices: SpeechSynthesisVoice[],
  lang = "ru-RU",
): SpeechSynthesisVoice | null {
  const language = lang.toLowerCase();
  const languagePrefix = language.split("-")[0];
  const matchingVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(languagePrefix),
  );
  if (matchingVoices.length === 0) return null;

  const score = (voice: SpeechSynthesisVoice) => {
    const name = `${voice.name} ${voice.voiceURI}`;
    return (
      (voice.lang.toLowerCase() === language ? 20 : 0) +
      (feminineVoiceNames.test(name) ? 100 : 0) +
      (naturalVoiceNames.test(name) ? 30 : 0)
    );
  };

  return matchingVoices.reduce((preferred, voice) =>
    score(voice) > score(preferred) ? voice : preferred,
  );
}
