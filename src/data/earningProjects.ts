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
];

export function findQuickEarningProject(
  availableMinutes: number,
): EarningProject | undefined {
  return EARNING_PROJECTS
    .filter((project) => project.quickTaskMinutes <= availableMinutes)
    .sort((left, right) => left.quickTaskMinutes - right.quickTaskMinutes)[0];
}
