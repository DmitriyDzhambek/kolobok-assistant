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

/** Иконка партнёра: аватар из хранилища → iconUrl → нейтральная буква. */
function PartnerIcon({ partner }: { partner: Partner }) {
	const [avatar, setAvatar] = useState(() => loadAvatar(partner.id));
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		setAvatar(loadAvatar(partner.id));
		setFailed(false);
	}, [partner.id, partner.iconUrl]);

	return (
		<div className="pc-icon">
			{avatar ? (
				<img src={avatar} alt="" className="pc-icon-img" />
			) : partner.iconUrl && !failed ? (
				<img
					src={partner.iconUrl}
					alt=""
					className="pc-icon-img"
					onError={() => setFailed(true)}
				/>
			) : (
				<span className="pc-icon-letter">
					{(partner.name || "?").charAt(0).toUpperCase()}
				</span>
			)}
		</div>
	);
}

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

/** Полная карточка партнёра — прямоугольник, glassmorphism, скругление 16px. */
function PartnerCard({ partner, index }: { partner: Partner; index: number }) {
	return (
		<motion.article
			className="partner-card"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -8 }}
			transition={{ duration: 0.2, delay: index * 0.06 }}
			whileHover={{ y: -3 }}
		>
			{/* Шапка */}
			<div className="pc-head">
				<PartnerIcon partner={partner} />
				<div className="pc-heads">
					<h3 className="pc-title">{partner.name}</h3>
					<p className="pc-desc">{partner.description}</p>
				</div>
				<span className="tg-badge">✈️ Mini App</span>
			</div>

			{partner.rewardText && <div className="pc-reward">{partner.rewardText}</div>}
			{partner.promoCode && <PromoBlock code={partner.promoCode} reward={partner.promoReward} />}
			{partner.incomeInfo && (
				<div className="pc-income">
					<span className="pc-income-ico">💸</span>
					<span>{partner.incomeInfo}</span>
				</div>
			)}

			<a
				className="pc-open"
				href={partner.url}
				target="_blank"
				rel="noopener noreferrer"
			>
				Открыть в Telegram →
			</a>
		</motion.article>
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
