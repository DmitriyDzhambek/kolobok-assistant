import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Flame,
  MapPin,
  Sun,
  Target,
} from "lucide-react";
import { localHabitsView } from "../habits/localStore";

type WeatherData = {
  temperature: number;
  code: number;
  condition: string;
  isDay: boolean;
  timezone: string;
  provider: "yandex" | "open-meteo";
};

type DashboardCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  delay: number;
};

function DashboardCard({
  icon,
  label,
  value,
  delay,
  onClick,
}: DashboardCardProps & { onClick?: () => void }) {
  const content = (
    <>
      <div className="dashboard-card-icon">{icon}</div>
      <div className="dashboard-card-copy">
        <div className="dashboard-card-label">{label}</div>
        <div className="dashboard-card-value">{value}</div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        className="dashboard-card dashboard-focus-card"
        onClick={onClick}
        aria-label={`${label}: ${value}. Открыть тренажёр английского`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay }}
        whileHover={{ scale: 1.04 }}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div
      className="dashboard-card"
      initial={{ y: 0 }}
      animate={{ y: [-6, 0, -6] }}
      transition={{
        duration: 3,
        ease: "easeInOut",
        repeat: Infinity,
        delay,
      }}
    >
      {content}
    </motion.div>
  );
}

function weatherDescription(code: number): string {
  if (code === 0) return "Ясно";
  if (code <= 3) return "Облачно";
  if (code === 45 || code === 48) return "Туман";
  if (code >= 51 && code <= 57) return "Морось";
  if (code >= 61 && code <= 67) return "Дождь";
  if (code >= 71 && code <= 77) return "Снег";
  if (code >= 80 && code <= 82) return "Ливень";
  if (code >= 85 && code <= 86) return "Снегопад";
  if (code >= 95) return "Гроза";
  return "Погода";
}

function WeatherIcon({ code, isDay }: Pick<WeatherData, "code" | "isDay">) {
  const className = "dashboard-weather-icon";
  if (code === 0) return <Sun className={className} />;
  if (code <= 3) return <Cloud className={className} />;
  if (code === 45 || code === 48) return <CloudFog className={className} />;
  if (code >= 51 && code <= 57) return <CloudDrizzle className={className} />;
  if (code >= 71 && code <= 77 || code >= 85 && code <= 86) {
    return <CloudSnow className={className} />;
  }
  if (code >= 61 && code <= 67 || code >= 80 && code <= 82) {
    return <CloudRain className={className} />;
  }
  if (code >= 95) return <CloudLightning className={className} />;
  return isDay ? <Sun className={className} /> : <Cloud className={className} />;
}

function WeatherCard() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [localTime, setLocalTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!weather) return;

    const updateTime = () => {
      try {
        setLocalTime(
          new Intl.DateTimeFormat("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: weather.timezone,
          }).format(new Date()),
        );
      } catch {
        setLocalTime(
          new Intl.DateTimeFormat("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date()),
        );
      }
    };

    updateTime();
    const intervalId = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(intervalId);
  }, [weather]);

  const loadWeather = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Геолокация недоступна");
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const query = new URLSearchParams({
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
          });
          try {
            const yandexResponse = await fetch(`/api/weather?${query.toString()}`);
            if (yandexResponse.ok) {
              const result: {
                temperature?: number;
                code?: number;
                condition?: string;
                isDay?: boolean;
                provider?: string;
              } = await yandexResponse.json();
              if (
                typeof result.temperature === "number" &&
                typeof result.code === "number" &&
                typeof result.condition === "string" &&
                typeof result.isDay === "boolean"
              ) {
                setWeather({
                  temperature: result.temperature,
                  code: result.code,
                  condition: result.condition,
                  isDay: result.isDay,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  provider: "yandex",
                });
                return;
              }
              console.warn("Яндекс.Погода вернула неполные данные; используется резервный источник.");
            } else {
              console.warn(
                `Яндекс.Погода недоступна (${yandexResponse.status}); используется резервный источник.`,
              );
            }
          } catch (yandexError) {
            console.warn("Не удалось получить ответ от Яндекс.Погоды; используется резервный источник.", yandexError);
          }

          const fallbackParams = new URLSearchParams({
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
            current: "temperature_2m,weather_code,is_day",
            timezone: "auto",
          });
          const fallbackResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?${fallbackParams.toString()}`,
          );
          if (!fallbackResponse.ok) {
            throw new Error(`Weather request failed: ${fallbackResponse.status}`);
          }

          const fallback: {
            timezone?: string;
            current?: {
              temperature_2m?: number;
              weather_code?: number;
              is_day?: number;
            };
          } = await fallbackResponse.json();
          const current = fallback.current;
          if (
            typeof current?.temperature_2m !== "number" ||
            typeof current.weather_code !== "number" ||
            !fallback.timezone
          ) {
            throw new Error("Weather response is incomplete");
          }

          setWeather({
            temperature: Math.round(current.temperature_2m),
            code: current.weather_code,
            condition: weatherDescription(current.weather_code),
            isDay: current.is_day === 1,
            timezone: fallback.timezone,
            provider: "open-meteo",
          });
        } catch (requestError) {
          console.error("Не удалось загрузить погоду:", requestError);
          setError("Не удалось загрузить погоду");
        } finally {
          setIsLoading(false);
        }
      },
      (positionError) => {
        setIsLoading(false);
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Разреши доступ к геопозиции"
            : "Не удалось определить место",
        );
      },
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 10_000 },
    );
  };

  return (
    <div className="dashboard-position dashboard-weather-position">
      {weather ? (
        <button
          type="button"
          className="dashboard-card dashboard-weather-card"
          onClick={loadWeather}
          aria-label={`Погода рядом с вами: ${weather.condition}, ${weather.temperature} градусов. Местное время ${localTime}. Источник: ${weather.provider === "yandex" ? "Яндекс.Погода" : "резервный источник"}. Обновить`}
        >
          <div className="dashboard-card-icon">
            <WeatherIcon code={weather.code} isDay={weather.isDay} />
          </div>
          <div className="dashboard-card-copy">
            <div className="dashboard-card-label">
              {weather.condition} · {localTime}
            </div>
            <div className="dashboard-card-value">{weather.temperature}°C</div>
          </div>
        </button>
      ) : (
        <button
          type="button"
          className="dashboard-card dashboard-weather-card dashboard-weather-button"
          onClick={loadWeather}
          disabled={isLoading}
          aria-label={error || "Определить погоду по геопозиции"}
        >
          <div className="dashboard-card-icon">
            {error ? <MapPin className="dashboard-weather-icon" /> : <Sun className="dashboard-weather-icon" />}
          </div>
          <div className="dashboard-card-copy">
            <div className="dashboard-card-label">Погода</div>
            <div className="dashboard-card-value">
              {isLoading
                ? "Загрузка…"
                : error === "Разреши доступ к геопозиции"
                  ? "Разреши геопозицию"
                  : error || "Определить место"}
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

export function Dashboard({ onFocusClick }: { onFocusClick?: () => void }) {
  const streakDays = localHabitsView().habits.reduce(
    (longest, habit) => Math.max(longest, habit.streak),
    0,
  );

  return (
    <div className="dashboard-overlay" aria-label="Сводка дня">
      <WeatherCard />
      <div className="dashboard-position dashboard-focus-position">
        <DashboardCard
          icon={<Target className="dashboard-stat-icon dashboard-focus-icon" />}
          label="Фокус дня"
          value="Английский"
          delay={1}
          onClick={onFocusClick}
        />
      </div>
      <div className="dashboard-position dashboard-streak-position">
        <DashboardCard
          icon={<Flame className="dashboard-stat-icon dashboard-streak-icon" />}
          label="Стрик дней"
          value={String(streakDays)}
          delay={0.5}
        />
      </div>
    </div>
  );
}
