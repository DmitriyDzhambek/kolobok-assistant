/** Утилита для определения контекста времени суток.
 * Используется для проактивных приветствий и передачи контекста в LLM. */

export type TimeOfDay = "night" | "morning" | "day" | "evening";

export interface TimeContext {
	/** Время суток */
	timeOfDay: TimeOfDay;
	/** Час в формате HH:MM */
	timeString: string;
	/** Текущий час */
	hour: number;
	/** Минута */
	minute: number;
	/** Полное приветствие от Колобка */
	greeting: string;
	/** Системный промпт для LLM */
	systemPrompt: string;
	/** Предложение еды/завтрака/обеда/ужина */
	foodSuggestion: string;
	/** Короткий индикатор для UI */
	badge: string;
}

/** Получить контекст времени для текущего момента */
export function getTimeContext(): TimeContext {
	const now = new Date();
	const hour = now.getHours();
	const minute = now.getMinutes();
	const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

	let timeOfDay: TimeOfDay;
	let greeting: string;
	let foodSuggestion: string;
	let badge: string;
	let systemPrompt: string;

	if (hour >= 5 && hour < 11) {
		// Утро (05:00 - 10:59)
		timeOfDay = "morning";
		badge = "🌅 Утро";
		systemPrompt = `Сейчас утро (${timeString}). Пользователь только начинает свой день. Будь бодрым и энергичным. Предложи быстрый и питательный завтрак (омлет, сырники, каши, смузи). Настрой на продуктивный день.`;
		
		const breakfastOptions = [
			`Доброе утро! Уже ${timeString}. Как насчет сытного омлета или быстрых сырников перед работой?`,
			`С добрым утром! ${timeString} — самое время для энергичного завтрака. Попробуй овсянку с ягодами или зелёный смузи!`,
			`Пора вставать, солнышко! ${timeString}. Предлагаю завтрак, который зарядит на весь день: творожная запеканка или бутерброды с авокадо.`,
		];
		greeting = breakfastOptions[Math.floor(Math.random() * breakfastOptions.length)];
		foodSuggestion = "завтрак";
	} else if (hour >= 11 && hour < 17) {
		// День (11:00 - 16:59)
		timeOfDay = "day";
		badge = "☀️ День";
		systemPrompt = `Сейчас день (${timeString}). Пользователь в активной фазе работы. Предложи лёгкий обед или перекус для поддержания энергии. Упомяни о необходимости сделать перерыв.`;
		
		const lunchOptions = [
			`Привет! Уже ${timeString}. Самое время для обеда! Сделаем легкий салат или что-то посерьезнее — ты выбирай!`,
			`Добрый день, друже! ${timeString} — перерыв на обед. Предлагаю суп-пюре или пасту с овощами. Ты же знаешь, что голодный Колобок — злой Колобок!`,
			`Уже ${timeString}? Время подкрепиться! Обеденный перерыв — это святое. Попробуй что-то из горячего, а потом вернёмся к делам.`,
		];
		greeting = lunchOptions[Math.floor(Math.random() * lunchOptions.length)];
		foodSuggestion = "обед";
	} else if (hour >= 17 && hour < 23) {
		// Вечер (17:00 - 22:59)
		timeOfDay = "evening";
		badge = "🌆 Вечер";
		systemPrompt = `Сейчас вечер (${timeString}). Пользователь завершает рабочий день. Предложи уютный ужин для расслабления. Будь заботливым и спокойным.`;
		
		const dinnerOptions = [
			`Добрый вечер! ${timeString} — идеальное время для ужина. Хочешь уютный суп или быстрый рецепт на сковороде?`,
			`Вечер на дворе, ${timeString}. День был непростым, но ты справился! Давай приготовим что-нибудь вкусненькое — рыбку с овощами или пасту карбонара?`,
			`Уже ${timeString}? Время расслабиться и поужинать! Предлагаю ужин, который поможет отдохнуть: запечённые овощи с курицей или ризотто.`,
		];
		greeting = dinnerOptions[Math.floor(Math.random() * dinnerOptions.length)];
		foodSuggestion = "ужин";
	} else {
		// Ночь (23:00 - 04:59)
		timeOfDay = "night";
		badge = "🌙 Ночь";
		systemPrompt = `Сейчас ночь (${timeString}). Пользователь либо ещё не спит, либо работает в ночную смену. Предложи лёгкий перекус, не нагружающий желудок. Будь тихим и нежным.`;
		
		const nightOptions = [
			`Не спится? Уже ${timeString}. Если хочешь перекусить, лучше выбрать что-то легкое — йогурт или фрукт, чтобы не нагружать желудок.`,
			`Поздний вечер, ${timeString}. Ночной страж на посту! Если проголодался — кефир или творог подойдут лучше всего.`,
			`Спокойной ночи... или нет? ${timeString}. Ночной перекус — дело тонкое. Лучше что-то лёгкое, чтобы сон не пропал.`,
		];
		greeting = nightOptions[Math.floor(Math.random() * nightOptions.length)];
		foodSuggestion = "лёгкий перекус";
	}

	return {
		timeOfDay,
		timeString,
		hour,
		minute,
		greeting,
		systemPrompt,
		foodSuggestion,
		badge,
	};
}

/** Проверить, было ли приветствие показано в текущей сессии */
export function wasGreetingShown(): boolean {
	return sessionStorage.getItem("kolobok-greeting-shown") === "true";
}

/** Отметить, что приветствие показано */
export function markGreetingShown(): void {
	sessionStorage.setItem("kolobok-greeting-shown", "true");
}

/** Проверить, нужно ли показать приветствие (не чаще раза за сессию) */
export function shouldShowGreeting(): boolean {
	return !wasGreetingShown();
}
