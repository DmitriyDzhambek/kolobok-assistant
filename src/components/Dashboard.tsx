import { motion } from "framer-motion";
import { Sun, Target, Coins } from "lucide-react";

/**
 * Тип для карточки дашборда
 */
type DashboardCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  delay: number;
};

/**
 * Карточка дашборда с анимацией левитации
 */
function DashboardCard({ icon, label, value, delay }: DashboardCardProps) {
  return (
    <motion.div
      className="relative flex flex-col items-center gap-2"
      initial={{ y: 0 }}
      animate={{ y: [-10, 0, -10] }}
      transition={{
        duration: 3,
        ease: "easeInOut",
        repeat: Infinity,
        delay: delay,
      }}
    >
      <motion.div
        className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-lg"
        whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(255,255,255,0.1)" }}
      >
        {icon}
      </motion.div>
      <div className="text-center">
        <div className="text-xs text-white/60 opacity-80">{label}</div>
        <div className="text-sm font-medium text-white/90">{value}</div>
      </div>
    </motion.div>
  );
}

/**
 * Интерактивный дашборд с парящими карточками вокруг Колобка
 */
export function Dashboard() {
  return (
    <>
      {/* Карточка погоды - слева */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 transform">
        <DashboardCard
          icon={<Sun className="w-8 h-8 text-yellow-400" />}
          label="Погода"
          value="+18°C"
          delay={0}
        />
      </div>

      {/* Карточка фокуса - справа */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 transform">
        <DashboardCard
          icon={<Target className="w-8 h-8 text-cyan-400" />}
          label="Фокус дня"
          value="Английский"
          delay={1}
        />
      </div>

      {/* Карточка заработка - снизу */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 transform">
        <DashboardCard
          icon={<Coins className="w-8 h-8 text-yellow-500" />}
          label="Заработано"
          value="120 ₽"
          delay={0.5}
        />
      </div>
    </>
  );
}
