import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	loadPartners,
	loadAvatar,
	subscribePartners,
	type Partner,
} from "../storage/partners";

export type { Partner };

/* ------------------------------------------------------------------ */
/* Утилиты                                                            */
/* ------------------------------------------------------------------ */

/** Копирование текста в буфер с запасным путём (для Telegram WebView). */
async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		/* падаем в запасной путь */
	}
	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(ta);
		return ok;
	} catch {
		return false;
	}
}

/* ------------------------------------------------------------------ */
/* Компоненты карточки                                                */
/* ------------------------------------------------------------------ */

/** Плашка промокода с копированием. */
function PromoBlock({ code, reward }: { code: string; reward?: string }) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<number | undefined>(undefined);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	const onCopy = async () => {
		const ok = await copyText(code);
		setCopied(ok);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setCopied(false), 1800);
	};

	return (
		<div className="pc-promo">
			<div className="pc-promo-head">🎁 Промокод</div>
			<button
				type="button"
				className={`pc-promo-copy${copied ? " ok" : ""}`}
				onClick={onCopy}
				title="Нажми, чтобы скопировать"
			>
				<span className="pc-promo-code">{code}</span>
				<span className="pc-promo-ico">{copied ? "✓" : "📋"}</span>
			</button>
			{reward && (
				<div className="pc-promo-hint">
					{copied ? "Скопировано!" : reward}
				</div>
			)}
		</div>
	);
}

/** Полная карточка партнёра — стеклянный «свиток» с золотой рамкой. */
function PartnerCard({ partner, index }: { partner: Partner; index: number }) {
	const [avatar, setAvatar] = useState(() => loadAvatar(partner.id));
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		setAvatar(loadAvatar(partner.id));
		setFailed(false);
	}, [partner.id, partner.iconUrl]);

	const initial = (partner.name || "?").charAt(0).toUpperCase();

	return (
		<article
			className="pa-card"
			style={{ animationDelay: `${index * 0.07}s` }}
		>
			{/* Бейдж Mini App — правый верхний угол */}
			<span className="pa-badge">✈️ Mini App</span>

			{/* Тело карточки */}
			<div className="pa-body">
				{/* Медальон-аватар */}
				<div className="pa-medal">
					{avatar ? (
						<img src={avatar} alt="" className="pa-medal-img" />
					) : partner.iconUrl && !failed ? (
						<img
							src={partner.iconUrl}
							alt=""
							className="pa-medal-img"
							onError={() => setFailed(true)}
						/>
					) : (
						<span className="pa-medal-letter">{initial}</span>
					)}
				</div>

				{/* Информация */}
				<div className="pa-info">
					<h3 className="pa-name">{partner.name}</h3>
					<p className="pa-desc">{partner.description}</p>
				</div>
			</div>

			{/* Награда */}
			{partner.rewardText && (
				<div className="pa-reward">
					<span className="pa-reward-ico">✨</span>
					{partner.rewardText}
				</div>
			)}

			{/* Промокод */}
			{partner.promoCode && (
				<PromoBlock code={partner.promoCode} reward={partner.promoReward} />
			)}

			{/* Доход */}
			{partner.incomeInfo && (
				<div className="pa-income">
					<span className="pa-income-ico">💸</span>
					{partner.incomeInfo}
				</div>
			)}

			{/* Кнопка — компактная стрелка в правом нижнем углу */}
			<a
				className="pa-link"
				href={partner.url}
				target="_blank"
				rel="noopener noreferrer"
				title="Открыть в Telegram"
			>
				<span className="pa-link-text">Открыть</span>
				<span className="pa-link-arrow">→</span>
			</a>
		</article>
	);
}

/* ------------------------------------------------------------------ */
/* Экспорт: вкладка «Заработок»                                       */
/* ------------------------------------------------------------------ */

export function PartnersPanel() {
	const [partners, setPartners] = useState<Partner[]>(loadPartners);

	useEffect(() => subscribePartners(() => setPartners(loadPartners())), []);

	return (
		<div className="partners glass">
			<div className="partners-head">
				<span className="partners-ico">💰</span>
				<div>
					<div className="partners-title">Заработок</div>
					<div className="partners-sub">
						Telegram Mini Apps — зарабатывай, не выходя из Telegram
					</div>
				</div>
			</div>

			<div className="partners-grid">
				<AnimatePresence>
					{partners.map((p, i) => (
						<PartnerCard key={p.id} partner={p} index={i} />
					))}
				</AnimatePresence>
			</div>

			<div className="partners-note">
				💡 Колобок катится по всем дорожкам — выбирай любую и забирай пользу!
				<br />
				<small>Ссылки открывают Mini App в Telegram.</small>
			</div>
		</div>
	);
}
