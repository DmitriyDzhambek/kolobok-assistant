import { useState, useEffect } from "react";
import { Kolobok } from "./components/Kolobok";
import { Background } from "./components/Background";
import { FirefliesCanvas } from "./components/FirefliesCanvas";
import { Dashboard } from "./components/Dashboard";
import "./styles.css";

/**
 * Приложение Kolobok с интерактивным дашбордом
 */
export default function App() {
  const [timeOfDay, setTimeOfDay] = useState("night");

  useEffect(() => {
    const updateTimeOfDay = () => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 12) setTimeOfDay("morning");
      else if (hour >= 12 && hour < 18) setTimeOfDay("day");
      else if (hour >= 18 && hour < 22) setTimeOfDay("evening");
      else setTimeOfDay("night");
    };
    updateTimeOfDay();
    const interval = setInterval(updateTimeOfDay, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`app tod-${timeOfDay}`}>
      <Background />
      <FirefliesCanvas />
      
      <header className="hdr">
        <h1 className="title">Колобок</h1>
        <div className="subtitle">
          Сказочный помощник твоего рабочего стола
        </div>
      </header>

      <main className="stage relative">
        {/* Интерактивный дашборд с парящими карточками */}
        <Dashboard />
        
        {/* Колобок по центру */}
        <div className="relative z-10 flex flex-col items-center">
          <Kolobok state="idle" timeOfDay={timeOfDay} />
          <div className="bubble mt-4">
            <div className="bubble-text">
              Привет! Я Колобок. Ты отдыхай, а я для тебя заработаю!
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
