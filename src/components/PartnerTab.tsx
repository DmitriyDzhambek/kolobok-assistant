import { motion } from "framer-motion";
import { ArrowUpRight, Copy, Gem } from "lucide-react";
import { tgWebApp } from "../tma";

const PARTNER_URL = "https://t.me/Earnings_Vault";

function openPartnerChannel() {
  const telegram = tgWebApp();
  if (telegram?.openLink) {
    telegram.openLink(PARTNER_URL);
  } else {
    window.open(PARTNER_URL, "_blank", "noopener,noreferrer");
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

      <motion.article
        className="partner-vault-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="partner-gem">
          <Gem size={34} aria-hidden="true" />
        </div>
        <span className="partner-card-label">ПРОВЕРЕННЫЙ КАНАЛ</span>
        <h3>Канал: Earnings Vault</h3>
        <p>
          Твой секретный источник пассивного дохода. Промокоды и лучшие связки.
        </p>

        <div className="partner-promo">
          <span>
            <Copy size={15} aria-hidden="true" />
            Промокоды
          </span>
          <strong>
            <span>Спасибо</span> за подписку
          </strong>
        </div>

        <button
          type="button"
          className="partner-subscribe"
          onClick={openPartnerChannel}
        >
          Подписаться и забрать промокод
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </motion.article>
    </section>
  );
}

export default PartnerTab;
