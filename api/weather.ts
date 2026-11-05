declare const process: {
	env: Record<string, string | undefined>;
};

type VercelRequest = {
	method?: string;
	query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
	setHeader(name: string, value: string): void;
	status(code: number): VercelResponse;
	json(body: unknown): void;
};

const CONDITIONS: Record<string, { label: string; code: number }> = {
	clear: { label: "Ясно", code: 0 },
	"partly-cloudy": { label: "Переменная облачность", code: 2 },
	cloudy: { label: "Облачно", code: 3 },
	overcast: { label: "Пасмурно", code: 3 },
	drizzle: { label: "Морось", code: 51 },
	"light-rain": { label: "Небольшой дождь", code: 61 },
	rain: { label: "Дождь", code: 63 },
	"moderate-rain": { label: "Дождь", code: 63 },
	"heavy-rain": { label: "Сильный дождь", code: 65 },
	"continuous-heavy-rain": { label: "Сильный дождь", code: 65 },
	showers: { label: "Ливень", code: 80 },
	"wet-snow": { label: "Мокрый снег", code: 67 },
	"light-snow": { label: "Небольшой снег", code: 71 },
	snow: { label: "Снег", code: 73 },
	"snow-showers": { label: "Снегопад", code: 85 },
	hail: { label: "Град", code: 85 },
	thunderstorm: { label: "Гроза", code: 95 },
	"thunderstorm-with-rain": { label: "Гроза с дождём", code: 95 },
	"thunderstorm-with-hail": { label: "Гроза с градом", code: 96 },
	unknown: { label: "Погода", code: 3 },
};

function getCoordinate(value: string | string[] | undefined): number | null {
	if (typeof value !== "string" || !value.trim()) return null;
	const coordinate = Number(value);
	return Number.isFinite(coordinate) ? coordinate : null;
}

export default async function handler(
	req: VercelRequest,
	res: VercelResponse,
): Promise<void> {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		res.status(405).json({ error: "Method not allowed" });
		return;
	}

	const latitude = getCoordinate(req.query.latitude);
	const longitude = getCoordinate(req.query.longitude);
	if (
		latitude === null ||
		longitude === null ||
		latitude < -90 ||
		latitude > 90 ||
		longitude < -180 ||
		longitude > 180
	) {
		res.status(400).json({ error: "Valid latitude and longitude are required" });
		return;
	}

	const apiKey = process.env.YANDEX_WEATHER_API_KEY;
	if (!apiKey) {
		res.status(503).json({ error: "Yandex Weather is not configured" });
		return;
	}

	const url = new URL("https://api.weather.yandex.ru/v2/forecast");
	url.searchParams.set("lat", latitude.toFixed(2));
	url.searchParams.set("lon", longitude.toFixed(2));
	url.searchParams.set("lang", "ru_RU");
	url.searchParams.set("limit", "1");
	url.searchParams.set("hours", "false");
	url.searchParams.set("extra", "false");

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 8_000);
	try {
		const upstream = await fetch(url, {
			headers: { "X-Yandex-Weather-Key": apiKey },
			signal: controller.signal,
		});
		if (!upstream.ok) {
			console.error("Yandex Weather request failed", upstream.status);
			res.status(502).json({ error: "Yandex Weather request failed" });
			return;
		}

		const payload: {
			fact?: { temp?: number; condition?: string; daytime?: string };
		} = await upstream.json();
		const fact = payload.fact;
		const condition =
			typeof fact?.condition === "string"
				? CONDITIONS[fact.condition]
				: undefined;
		if (
			typeof fact?.temp !== "number" ||
			!Number.isFinite(fact.temp) ||
			!condition
		) {
			console.error("Yandex Weather returned an incomplete forecast");
			res.status(502).json({ error: "Yandex Weather returned invalid data" });
			return;
		}

		res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=300");
		res.status(200).json({
			temperature: Math.round(fact.temp),
			code: condition.code,
			condition: condition.label,
			isDay: fact.daytime === "d",
			provider: "yandex",
		});
	} catch (error) {
		console.error("Unable to reach Yandex Weather", error);
		res.status(502).json({ error: "Unable to reach Yandex Weather" });
	} finally {
		clearTimeout(timeoutId);
	}
}
