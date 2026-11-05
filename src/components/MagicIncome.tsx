import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, DollarSign, Gem, Sparkles, Timer } from "lucide-react";
import { AutoPilotModal } from "./AutoPilotModal";
import { EARNING_PROJECTS, type EarningProject } from "../data/earningProjects";
import type { CryptoCurrency } from "../dreams/storage";

type MagicIncomeProps = {
  suggestedProjectId?: string;
  onSuggestionHandled?: () => void;
  onEarningRecorded?: (amount: number, currency: CryptoCurrency) => void;
};

function projectIcon(project: EarningProject) {
  return project.id === "moneybux" ? Gem : DollarSign;
}

export function MagicIncome({
  suggestedProjectId,
  onSuggestionHandled,
  onEarningRecorded,
}: MagicIncomeProps) {
  const [selectedProject, setSelectedProject] = useState<EarningProject | null>(
    null,
  );
  const suggestedProject = EARNING_PROJECTS.find(
    (project) => project.id === suggestedProjectId,
  );

  const selectProject = (project: EarningProject) => {
    setSelectedProject(project);
    onSuggestionHandled?.();
  };

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

      <AnimatePresence>
        {suggestedProject && (
          <motion.aside
            className="smart-earning-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="smart-earning-icon">
              <Timer size={22} aria-hidden="true" />
            </div>
            <div className="smart-earning-copy">
              <span>ПОД ТВОЁ СВОБОДНОЕ ВРЕМЯ</span>
              <strong>{suggestedProject.title}</strong>
              <p>{suggestedProject.quickTaskDescription}</p>
            </div>
            <button
              type="button"
              className="income-earn-button"
              onClick={() => selectProject(suggestedProject)}
            >
              Открыть
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="magic-grid">
        {EARNING_PROJECTS.map((project, index) => {
          const Icon = projectIcon(project);
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
                  onClick={() => selectProject(project)}
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
            onEarningRecorded={onEarningRecorded}
            projectName={selectedProject.title}
            telegramLink={selectedProject.url}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
