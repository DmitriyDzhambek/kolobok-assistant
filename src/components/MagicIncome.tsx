import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Search, Filter, X, Star, Clock, DollarSign, Users, Heart, Zap } from "lucide-react";
import { AutoPilotModal } from "./AutoPilotModal";

/**
 * Категории источников дохода
 */
export type IncomeCategory = "all" | "crypto" | "surveys" | "cashback" | "fast";

/**
 * Источник дохода
 */
export interface IncomeSource {
  id: string;
  title: string;
  description: string;
  reward: string;
  category: IncomeCategory;
  icon: React.ReactNode;
  telegramLink: string;
  tags?: string[];
}

/**
 * Фильтр
 */
export interface FilterOption {
  id: IncomeCategory;
  label: string;
  icon: React.ReactNode;
}

/**
 * Mock данные источников дохода
 */
const incomeSourcesData: IncomeSource[] = [
  {
    id: "usdttonflow",
    title: "UsdtTonFlow Bot",
    description: "Выполняйте задания и приглашайте друзей - и обменивайте золото на TON, USDT, звёзды и подарки Telegram",
    reward: "До 500₽/день",
    category: "crypto",
    icon: <DollarSign className="w-6 h-6 text-yellow-400" />,
    telegramLink: "https://t.me/UsdtTonFlow_bot",
    tags: ["TON", "USDT", "Реклама"],
  },
  {
    id: "tonwhales",
    title: "TON Whales",
    description: "Платформа для заработка TON монет. Участвуйте в Campaigns, выполняйте задания, получайте вознаграждения",
    reward: "До 1000₽/неделю",
    category: "crypto",
    icon: <Zap className="w-6 h-6 text-blue-400" />,
    telegramLink: "https://tonwhales.com/",
    tags: ["TON", "Крипта"],
  },
  {
    id: "tapswap",
    title: "Tapswap",
    description: "Игра с кликерами в Telegram. Зарабатывайте монеты, кликая по экрану и выполняя простые задания",
    reward: "До 300₽/день",
    category: "crypto",
    icon: <Heart className="w-6 h-6 text-pink-400" />,
    telegramLink: "https://t.me/tapswap_bot",
    tags: ["Кликер", "USDT"],
  },
  {
    id: "blum",
    title: "Blum",
    description: "Мобильное приложение для заработка криптовалюты. Собирайте монеты, выполняйте задания, участвуйте в events",
    reward: "До 200₽/день",
    category: "crypto",
    icon: <Star className="w-6 h-6 text-purple-400" />,
    telegramLink: "https://blum.codes/",
    tags: ["Крипта", "Мобильное"],
  },
  {
    id: "anketa",
    title: "Anketa",
    description: "Платформа для прохождения опросов. Отвечайте на вопросы и получайте деньги на счет",
    reward: "До 300₽/час",
    category: "surveys",
    icon: <Users className="w-6 h-6 text-green-400" />,
    telegramLink: "https://anketa.ru/",
    tags: ["Опросы", "Быстро"],
  },
  {
    id: "toloka",
    title: "Toloka",
    description: "Платформа от Яндекса для выполнения микро-заданий. Разметка данных, модерация контента",
    reward: "До 500₽/день",
    category: "surveys",
    icon: <Search className="w-6 h-6 text-red-400" />,
    telegramLink: "https://toloka.yandex.ru/",
    tags: ["Микро-задания", "Yandex"],
  },
  {
    id: "admitad",
    title: "Admitad Cashback",
    description: "Кэшбэк-сервис для покупок в интернете. Получайте процент от покупок в популярных магазинах",
    reward: "До 10% с покупки",
    category: "cashback",
    icon: <DollarSign className="w-6 h-6 text-orange-400" />,
    telegramLink: "https://www.admitad.com/ru/",
    tags: ["Кэшбэк", "Покупки"],
  },
  {
    id: "letyshops",
    title: "LetyShops",
    description: "Кэшбэк-сервис с широкой сетью партнеров. Возврат части стоимости от покупок",
    reward: "До 30% с покупки",
    category: "cashback",
    icon: <Sparkles className="w-6 h-6 text-yellow-500" />,
    telegramLink: "https://letyshops.com/",
    tags: ["Кэшбэк", "Онлайн"],
  },
  {
    id: "clickru",
    title: "Click.ru",
    description: "Быстрые задания для заработка. Просмотр рекламы, клики, регистрации на сайтах",
    reward: "До 200₽/час",
    category: "fast",
    icon: <Clock className="w-6 h-6 text-cyan-400" />,
    telegramLink: "https://click.ru/",
    tags: ["Быстро", "Реклама"],
  },
  {
    id: "socpublic",
    title: "Socpublic",
    description: "Платформа для заработка в социальных сетях. Лайки, репосты, подписки, комментарии",
    reward: "До 150₽/день",
    category: "fast",
    icon: <Users className="w-6 h-6 text-indigo-400" />,
    telegramLink: "https://socpublic.com/",
    tags: ["Соцсети", "Лайки"],
  },
];

/**
 * Опции фильтров
 */
const filterOptions: FilterOption[] = [
  { id: "all", label: "Все", icon: <Sparkles className="w-4 h-4" /> },
  { id: "crypto", label: "Крипта", icon: <Zap className="w-4 h-4" /> },
  { id: "surveys", label: "Опросы", icon: <Users className="w-4 h-4" /> },
  { id: "cashback", label: "Кэшбэк", icon: <DollarSign className="w-4 h-4" /> },
  { id: "fast", label: "Быстрые", icon: <Clock className="w-4 h-4" /> },
];

/**
 * Анимации для карточек
 */
const cardAnimations = {
  hidden: { opacity: 0, y: 50, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: "easeOut",
    },
  }),
  hover: {
    scale: 1.03,
    y: -5,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    y: 50,
    scale: 0.9,
    transition: { duration: 0.3 },
  },
};

/**
 * Анимация для модального окна
 */
const modalAnimation = {
  hidden: { opacity: 0, scale: 0.9, y: -50 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -50,
    transition: { duration: 0.3 },
  },
};

/**
 * Экран "Магия Дохода" - каталог источников пассивного заработка
 */
export function MagicIncome() {
  const [activeFilter, setActiveFilter] = useState<IncomeCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<IncomeSource | null>(null);
  const [showAutoPilot, setShowAutoPilot] = useState(false);

  // Фильтрация источников
  const filteredSources = useMemo(() => {
    return incomeSourcesData.filter((source) => {
      const matchesCategory = activeFilter === "all" || source.category === activeFilter;
      const matchesSearch = searchQuery === "" || 
        source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [activeFilter, searchQuery]);

  // Обработка клика по карточке
  const handleCardClick = (source: IncomeSource) => {
    setSelectedSource(source);
  };

  // Закрытие модального окна
  const closeModal = () => {
    setSelectedSource(null);
  };

  // Запуск автопилота
  const handleStartAutoPilot = () => {
    if (selectedSource) {
      setShowAutoPilot(true);
    }
  };

  // Закрытие автопилота
  const handleCloseAutoPilot = () => {
    setShowAutoPilot(false);
    setSelectedSource(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Фон с магическим эффектом */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(139,92,246,0.1)_0%,_transparent_70%)]" />

      {/* Заголовок */}
      <header className="relative z-10 p-6 text-center">
        <motion.h1
          className="text-3xl md:text-4xl font-bold text-white mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Магия Дохода
        </motion.h1>
        <motion.p
          className="text-white/60 text-lg"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          101 источник пассивного заработка
        </motion.p>
      </header>

      {/* Панель поиска и фильтров */}
      <motion.div
        className="relative z-10 px-6 mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {/* Поиск */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder="Поиск источников дохода..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
          />
        </div>

        {/* Фильтры */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filterOptions.map((filter) => (
            <motion.button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === filter.id
                  ? "bg-purple-600/20 border border-purple-500/30 text-white"
                  : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 + filterOptions.indexOf(filter) * 0.05 }}
            >
              {filter.icon}
              <span>{filter.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Сетка карточек */}
      <motion.div
        className="relative z-10 px-6 pb-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        {filteredSources.length === 0 ? (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">Ничего не найдено</h3>
            <p className="text-white/60">Попробуйте изменить фильтр или поисковый запрос</p>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            initial="hidden"
            animate="visible"
          >
            {filteredSources.map((source, index) => (
              <motion.div
                key={source.id}
                custom={index}
                variants={cardAnimations}
                whileHover="hover"
                exit="exit"
                className="relative"
              >
                <motion.div
                  className="relative h-full rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden cursor-pointer group"
                  onClick={() => handleCardClick(source)}
                  whileHover={{ boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
                >
                  {/* Магический светящийся эффект */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 group-hover:from-purple-500/20 group-hover:to-blue-500/20 transition-all duration-500" />
                  
                  {/* Иконка */}
                  <div className="relative z-10 p-4">
                    <motion.div
                      className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center backdrop-blur-sm"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.3 }}
                    >
                      {source.icon}
                    </motion.div>
                  </div>

                  {/* Контент карточки */}
                  <div className="relative z-10 px-4 pb-4">
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">
                      {source.title}
                    </h3>
                    <p className="text-sm text-white/60 mb-3 line-clamp-2">
                      {source.description}
                    </p>
                    
                    {/* Теги */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {source.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 rounded-full bg-white/10 text-xs text-white/80"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Вознаграждение и кнопка */}
                    <div className="flex items-center justify-between">
                      <motion.span
                        className="text-sm font-medium text-green-400"
                        whileHover={{ scale: 1.05 }}
                      >
                        {source.reward}
                      </motion.span>
                      <motion.button
                        className="px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 text-sm font-medium hover:bg-purple-600/30 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(source);
                        }}
                      >
                        Открыть
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Модальное окно с подробностями */}
      <AnimatePresence>
        {selectedSource && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Overlay */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            />

            {/* Модалка */}
            <motion.div
              className="relative w-full max-w-md max-h-[90vh] bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 shadow-2xl overflow-y-auto"
              variants={modalAnimation}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Заголовок */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                    {selectedSource.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-white truncate">
                      {selectedSource.title}
                    </h3>
                    <p className="text-sm text-white/60">{selectedSource.reward}</p>
                  </div>
                  <button
                    className="ml-auto p-1 rounded-lg hover:bg-white/10 transition-colors"
                    onClick={closeModal}
                  >
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>
              </div>

              {/* Описание */}
              <div className="p-6">
                <p className="text-white/80 mb-6">{selectedSource.description}</p>

                {/* Теги */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-sm">
                    Категория: {selectedSource.category === "crypto" ? "Крипта" : 
                              selectedSource.category === "surveys" ? "Опросы" :
                              selectedSource.category === "cashback" ? "Кэшбэк" : "Быстрые"}
                  </span>
                  {selectedSource.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Кнопки действий */}
                <div className="flex gap-3">
                  <motion.button
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600/20 text-purple-300 font-medium hover:bg-purple-600/30 transition-colors"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      window.open(selectedSource.telegramLink, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Перейти в Telegram</span>
                  </motion.button>
                  <motion.button
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleStartAutoPilot}
                  >
                    <Zap className="w-5 h-5" />
                    <span>Заработать</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Автопилот */}
      {showAutoPilot && selectedSource && (
        <AutoPilotModal
          source={selectedSource}
          onClose={handleCloseAutoPilot}
        />
      )}
    </div>
  );
}
