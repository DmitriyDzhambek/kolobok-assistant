import { motion } from "framer-motion";
import { ArrowUpRight, Copy, Gem } from "lucide-react";
import { tgWebApp } from "../tma";

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

function openPartnerChannel(url: string) {
  const telegram = tgWebApp();
  if (telegram?.openLink) {
    telegram.openLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function PartnerTab() {
  return (
    <section className="partner-screen" aria-labelledby="partner-title">
      <div className="partner-heading">
        <span className="partner-eyebrow">СЕКРЕТНОЕ ХРАНИЛИЩЕ</span>
        <h2 id="partner-title">Партнёры</h2>
        <p>Подборка полезных предложений от Колобка</p>
      </div>

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
