import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, DollarSign, Gem, Sparkles } from "lucide-react";
import { AutoPilotModal } from "./AutoPilotModal";

type IncomeProject = {
  id: string;
  title: string;
  description: string;
  reward: string;
  tags: string[];
  icon: typeof DollarSign;
  url: string;
};

const incomeProjects: IncomeProject[] = [
  {
    id: "usdttonflow",
    title: "USDT TonFlow",
    description:
      "Приглашай друзей, получай 20 % от дохода каждого друга и напиши им спасибо за труд.",
    reward: "20 % от дохода друзей",
    tags: ["TON", "USDT", "Реклама"],
    icon: DollarSign,
    url: "https://t.me/UsdtTonFlow_bot?startapp=UHFCI2C",
  },
  {
    id: "moneybux",
    title: "Money Bux",
    description:
      "Смотри рекламу, выполняй задания и обменивай золото на TON и USDT.",
    reward: "Награды за задания",
    tags: ["TON", "USDT", "Реклама"],
    icon: Gem,
    url: "https://t.me/MBuxBot/app?startapp=r_1053702516",
  },
];

export function MagicIncome() {
  const [selectedProject, setSelectedProject] = useState<IncomeProject | null>(
    null,
  );

  return (
    <section className="magic-screen" aria-labelledby="magic-title">
      <div className="magic-heading">
        <span className="magic-eyebrow">
          <Sparkles size={15} aria-hidden="true" />
          Возможности для заработка
        </span>
        <h2 id="magic-title">Магия дохода</h2>
        <p>Выбери проект и узнай, как начать.</p>
      </div>

      <div className="magic-grid">
        {incomeProjects.map((project, index) => {
          const Icon = project.icon;
          return (
            <motion.article
              key={project.id}
              className="income-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.08 }}
              whileHover={{ y: -4 }}
            >
              <div className="income-card-top">
                <span className="income-icon">
                  <Icon size={25} aria-hidden="true" />
                </span>
                <span className="income-card-badge">ПАРТНЁРСКИЙ ПРОЕКТ</span>
              </div>
              <h3>{project.title}</h3>
              <p className="income-description">{project.description}</p>
              <div className="income-tags">
                {project.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="income-card-bottom">
                <div className="income-reward">
                  <span>ВОЗНАГРАЖДЕНИЕ</span>
                  <strong>{project.reward}</strong>
                </div>
                <button
                  type="button"
                  className="income-earn-button"
                  onClick={() => setSelectedProject(project)}
                >
                  Заработать
                  <ArrowUpRight size={17} aria-hidden="true" />
                </button>
              </div>
            </motion.article>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedProject && (
          <AutoPilotModal
            key={selectedProject.id}
            isOpen
            onClose={() => setSelectedProject(null)}
            projectName={selectedProject.title}
            telegramLink={selectedProject.url}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
