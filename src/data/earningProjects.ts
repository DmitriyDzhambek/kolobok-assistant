export type EarningProject = {
  id: string;
  title: string;
  description: string;
  reward: string;
  tags: string[];
  url: string;
  quickTaskMinutes: number;
  quickTaskDescription: string;
};

export const EARNING_PROJECTS: EarningProject[] = [
  {
    id: "usdttonflow",
    title: "USDT TonFlow",
    description:
      "Приглашай друзей, получай 20 % от дохода каждого друга и напиши им спасибо за труд.",
    reward: "20 % от дохода друзей",
    tags: ["TON", "USDT", "Реклама"],
    url: "https://t.me/UsdtTonFlow_bot?startapp=UHFCI2C",
    quickTaskMinutes: 15,
    quickTaskDescription: "посмотреть предложения и выбрать задание",
  },
  {
    id: "moneybux",
    title: "Money Bux",
    description:
      "Смотри рекламу, выполняй задания и обменивай золото на TON и USDT.",
    reward: "Награды за задания",
    tags: ["TON", "USDT", "Реклама"],
    url: "https://t.me/MBuxBot/app?startapp=r_1053702516",
    quickTaskMinutes: 10,
    quickTaskDescription: "выполнить короткое задание или опрос",
  },
  {
    id: "grambux",
    title: "Gram Bux",
    description:
      "Подписывайся на канал и получай 0.10 звезды за подписку. Запускай ботов и приложения — за запуск начисляют 0.20 звезды.",
    reward: "0.10 звезды за подписку",
    tags: ["Звёзды", "Telegram", "Боты"],
    url: "https://t.me/GramBux_bot?start=ref1053702516",
    quickTaskMinutes: 5,
    quickTaskDescription: "подписаться на канал или запустить приложение",
  },
  {
    id: "paidz",
    title: "PaidZ",
    description:
      "Смотри от 50 реклам в день и откладывай на свою хотелку. Минимальный вывод — от 0.50 USDT.",
    reward: "От 0.50 USDT к выводу",
    tags: ["USDT", "Реклама", "Telegram"],
    url: "https://t.me/paidzapp/start?startapp=ref_75adf416",
    quickTaskMinutes: 10,
    quickTaskDescription: "посмотреть рекламу и пополнить накопления",
  },
];

export function findQuickEarningProject(
  availableMinutes: number,
): EarningProject | undefined {
  return EARNING_PROJECTS
    .filter((project) => project.quickTaskMinutes <= availableMinutes)
    .sort((left, right) => left.quickTaskMinutes - right.quickTaskMinutes)[0];
}
