import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Copy, Gem, Volume2 } from "lucide-react";
import { tgWebApp } from "../tma";

const FEATURED_PARTNER_KEY = "kolobok.featured-partner.v1";

const PARTNERS = [
  {
    name: "Earnings Vault",
    description:
      "Твой секретный источник пассивного дохода. Промокоды и лучшие связки.",
    promo: "Спасибо за подписку",
    url: "https://t.me/Earnings_Vault",
    badge: "ПРОВЕРЕННЫЙ КАНАЛ",
  },
  {
    name: "UsdtTonFlow Promo",
    description: 'Промокоды для "USDT TonFlow" от разработчика.',
    promo: "Промокоды от разработчика",
    url: "https://t.me/usdtpromofliw",
    badge: "ПРОМОКОДЫ USDT TONFLOW",
  },
];

function getFeaturedPartnerIndex(): number {
  if (typeof window === "undefined") return 0;
  try {
    const savedIndex = Number(window.sessionStorage.getItem(FEATURED_PARTNER_KEY));
    return Number.isInteger(savedIndex) && savedIndex >= 0
      ? savedIndex % PARTNERS.length
      : 0;
  } catch (error) {
    console.error("Не удалось прочитать очередь партнёров:", error);
    return 0;
  }
}

function openPartnerChannel(url: string) {
  const telegram = tgWebApp();
  if (telegram?.openLink) {
    telegram.openLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function PartnerTab() {
  const [featuredPartnerIndex] = useState(getFeaturedPartnerIndex);
  const [isPromptDismissed, setIsPromptDismissed] = useState(false);
  const featuredPartner = PARTNERS[featuredPartnerIndex];
  const announcement =
    `Заглянем в канал ${featuredPartner.name}? Там можно проверить свежие публикации и актуальные промокоды. Открыть канал?`;

  const speakAnnouncement = useCallback(() => {
    if (
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(announcement);
    utterance.lang = "ru-RU";
    utterance.rate = 1;
    utterance.pitch = 1.1;
    utterance.onerror = (event) => {
      if (event.error !== "canceled") {
        console.error("Не удалось озвучить предложение партнёра:", event.error);
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [announcement]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        FEATURED_PARTNER_KEY,
        String((featuredPartnerIndex + 1) % PARTNERS.length),
      );
    } catch (error) {
      console.error("Не удалось сохранить очередь партнёров:", error);
    }

    speakAnnouncement();
    return () => window.speechSynthesis?.cancel();
  }, [featuredPartnerIndex, speakAnnouncement]);

  return (
    <section className="partner-screen" aria-labelledby="partner-title">
      <div className="partner-heading">
        <span className="partner-eyebrow">СЕКРЕТНОЕ ХРАНИЛИЩЕ</span>
        <h2 id="partner-title">Партнёры</h2>
        <p>Подборка полезных предложений от Колобка</p>
      </div>

      {!isPromptDismissed && (
        <motion.aside
          className="partner-news-prompt"
          aria-label="Предложение Колобка проверить партнёрский канал"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="partner-news-copy">
            <span>СЛЕДУЮЩИЙ КАНАЛ ДЛЯ ПРОВЕРКИ</span>
            <strong>{featuredPartner.name}</strong>
            <p>
              Проверим свежие публикации и промокоды в канале партнёра?
            </p>
          </div>
          <div className="partner-news-actions">
            <button
              type="button"
              className="partner-news-open"
              onClick={() => openPartnerChannel(featuredPartner.url)}
            >
              Открыть канал
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="partner-news-repeat"
              onClick={speakAnnouncement}
              aria-label="Повторить приглашение голосом"
            >
              <Volume2 size={17} aria-hidden="true" />
              Повторить
            </button>
            <button
              type="button"
              className="partner-news-dismiss"
              onClick={() => setIsPromptDismissed(true)}
            >
              Не сейчас
            </button>
          </div>
        </motion.aside>
      )}

      <div className="partner-grid">
        {PARTNERS.map((partner, index) => (
          <motion.article
            key={partner.name}
            className="partner-vault-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
          >
            <div className="partner-gem">
              <Gem size={34} aria-hidden="true" />
            </div>
            <span className="partner-card-label">{partner.badge}</span>
            <h3>Канал: {partner.name}</h3>
            <p>{partner.description}</p>

            <div className="partner-promo">
              <span>
                <Copy size={15} aria-hidden="true" />
                Промокоды
              </span>
              <strong>
                {partner.promo === "Спасибо за подписку" ? (
                  <>
                    <span>Спасибо</span> за подписку
                  </>
                ) : (
                  partner.promo
                )}
              </strong>
            </div>

            <button
              type="button"
              className="partner-subscribe"
              onClick={() => openPartnerChannel(partner.url)}
            >
              Подписаться и забрать промокод
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

export default PartnerTab;
