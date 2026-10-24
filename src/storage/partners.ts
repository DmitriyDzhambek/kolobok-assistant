/** Единое хранилище партнёров и их аватарок.
 *
 * Раньше витрина («Заработок») читала жёстко зашитый массив, а админ-панель
 * писала свою копию в localStorage — правки админа не попадали на витрину.
 * Теперь оба экрана работают с одним источником: localStorage + дефолтный
 * список, а изменения рассылываются подписчикам (usePartners).
 */

export type Partner = {
	id: string;
	name: string;
	description: string;
	rewardText: string;
	url: string;
	iconUrl: string;
	promoCode?: string;
	promoReward?: string;
	incomeInfo?: string;
};

const PARTNERS_KEY = "kolobok-partners";
const AVATAR_KEY = (id: string) => `kolobok-partner-avatar-${id}`;

/** Список по умолчанию — то, что видит новый пользователь. */
export const DEFAULT_PARTNERS: Partner[] = [
	{
		id: "earningsvault",
		name: "Earnings Vault",
		description: "Хранилище заработка — Mini App для пассивного дохода",
		rewardText: "",
		url: "https://t.me/Earnings_Vault",
		iconUrl: "",
	},
	{
		id: "buzzcash",
		name: "BuzzCash",
		description: "Добро пожаловать в \"Buzzcash\" Легкий и быстрый заработок начни зарабатывать сейчас",
		rewardText: "",
		url: "https://t.me/buzzcashiobot?start=1053702516",
		iconUrl: "",
	},
	{
		id: "moneybux",
		name: "Money Bux",
		description: "Пригласите друзей и зарабатывайте: 100% дохода от выполнения заданий, 10% дохода от предложений на стенах объявлений",
		rewardText: "+100 монет за первый вход",
		url: "https://t.me/MBuxBot/app?startapp=r_1053702516",
		iconUrl: "",
	},
];

function normalize(list: unknown): Partner[] {
	if (!Array.isArray(list)) return [];
	return list
		.filter((p): p is Partner => !!p && typeof p === "object" && typeof p.id === "string")
		.map((p) => ({
			id: String(p.id),
			name: String(p.name ?? ""),
			description: String(p.description ?? ""),
			rewardText: String(p.rewardText ?? ""),
			url: String(p.url ?? ""),
			iconUrl: String(p.iconUrl ?? ""),
			promoCode: p.promoCode ? String(p.promoCode) : undefined,
			promoReward: p.promoReward ? String(p.promoReward) : undefined,
			incomeInfo: p.incomeInfo ? String(p.incomeInfo) : undefined,
		}));
}

/** Список партнёров: сохранённая админом версия, иначе — список по умолчанию. */
export function loadPartners(): Partner[] {
	try {
		const raw = localStorage.getItem(PARTNERS_KEY);
		if (!raw) return DEFAULT_PARTNERS;
		const parsed = normalize(JSON.parse(raw));
		return parsed.length ? parsed : DEFAULT_PARTNERS;
	} catch {
		return DEFAULT_PARTNERS;
	}
}

export function savePartners(list: Partner[]) {
	try {
		localStorage.setItem(PARTNERS_KEY, JSON.stringify(list));
	} catch {
		/* localStorage переполнен — оставляем прежние данные */
	}
	emit();
}

/** Аватарка партнёра, загруженная админом (base64). */
export function loadAvatar(id: string): string | null {
	try {
		return localStorage.getItem(AVATAR_KEY(id));
	} catch {
		return null;
	}
}

export function saveAvatar(id: string, dataUrl: string) {
	try {
		localStorage.setItem(AVATAR_KEY(id), dataUrl);
	} catch {
		/* noop */
	}
	emit();
}

export function removeAvatar(id: string) {
	try {
		localStorage.removeItem(AVATAR_KEY(id));
	} catch {
		/* noop */
	}
	emit();
}

/* ---------- подписка на изменения ---------- */

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
	listeners.forEach((l) => {
		try {
			l();
		} catch {
			/* noop */
		}
	});
}

/** Подписка на любые изменения списка/аватарок (в этой вкладке). */
export function subscribePartners(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

// Изменения из других вкладок.
if (typeof window !== "undefined") {
	window.addEventListener("storage", (e) => {
		const k = e.key || "";
		if (k === PARTNERS_KEY || k.startsWith("kolobok-partner-avatar-")) emit();
	});
}
