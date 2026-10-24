import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** Ключи localStorage для аватарок партнёров */
const AVATAR_KEY = (id: string) => `partner-avatar-${id}`;

/** Загрузка аватарки партнёра из файла */
function loadAvatar(id: string): string | null {
	try {
		return localStorage.getItem(AVATAR_KEY(id));
	} catch {
		return null;
	}
}

/** Сохранение аватарки партнёра в localStorage */
function saveAvatar(id: string, dataUrl: string) {
	try {
		localStorage.setItem(AVATAR_KEY(id), dataUrl);
	} catch {
		/* localStorage full — игнорируем */
	}
}

/** Удаление аватарки партнёра */
function removeAvatar(id: string) {
	try {
		localStorage.removeItem(AVATAR_KEY(id));
	} catch {
		/* noop */
	}
}

/** Конвертация файла в base64 с ограничением размера */
function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

/** Кнопка загрузки аватарки — появляется при наведении на иконку партнёра */
function AvatarUpload({
	 appId,
	 currentSrc,
	 onUpload,
	 onRemove,
}: {
	appId: string;
	currentSrc: string | null;
	onUpload: (dataUrl: string) => void;
	onRemove: () => void;
}) {
	const [isHovered, setIsHovered] = useState(false);
	const [preview, setPreview] = useState<string | null>(currentSrc);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setPreview(currentSrc);
	}, [currentSrc]);

	const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		// Ограничение: не более 1 МБ
		if (file.size > 1024 * 1024) {
			alert("Файл слишком большой. Максимум 1 МБ.");
			return;
		}
		// Сжимаем картинку до 128x128
		const dataUrl = await fileToBase64(file);
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			const size = 128;
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d")!;
			const scale = Math.max(size / img.width, size / img.height);
			const w = img.width * scale;
			const h = img.height * scale;
			ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
			const compressed = canvas.toDataURL("image/jpeg", 0.8);
			onUpload(compressed);
		};
		img.src = dataUrl;
		// Сбрасывем input, чтобы можно было загрузить тот же файл
		e.target.value = "";
	};

	return (
		<div
			className="avatar-wrap"
			onPointerEnter={() => setIsHovered(true)}
			onPointerLeave={() => setIsHovered(false)}
		>
			{preview ? (
				<div className="avatar-circle">
					<img src={preview} alt="" className="avatar-img" />
					{isHovered && (
						<div className="avatar-overlay">
							<button
								className="avatar-btn-remove"
								onClick={onRemove}
								title="Удалить аватарку"
							>
								✕
							</button>
						</div>
					)}
				</div>
			) : (
				<div
					className="avatar-placeholder"
					onPointerDown={() => inputRef.current?.click()}
					title="Загрузить аватарку"
				>
					📷
				</div>
			)}
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				style={{ display: "none" }}
				onChange={handleFile}
			/>
			{isHovered && !preview && (
				<div className="avatar-tooltip">Загрузить</div>
			)}
		</div>
	);
}

/**
 * ⬇⬇⬇ ЗДЕСЬ МЕНЯЙ ССЫЛКИ И ТЕКСТЫ ПАРТНЁРОВ ⬇⬇⬇
 * Это Telegram Mini Apps — ссылки вида t.me/.../app
 * iconUrl — прямая ссылка на логотип (или оставь пустым — будет буква)
 */
export const partnerApps = [
	{
		id: "earningsvault",
		name: "Earnings Vault",
		description: "Хранилище заработка — Mini App для пассивного дохода",
		rewardText: "+5% бонус за регистрацию по промокоду KOL0B0K",
		url: "https://t.me/Earnings_Vault",
		iconUrl: "",
		promoCode: "KOL0B0K",
		promoReward: "5% бонус при регистрации",
		incomeInfo: "Доход от 50₽/день — задания, рефералы, ежедневные бонусы",
	},
	{
		id: "buzzcash",
		name: "BuzzCash",
		description: "Заработок на просмотре рекламы и простых заданиях",
		rewardText: "+2.5% к балансу за регистрацию",
		url: "https://t.me/BuzzCash_bot/app",
		iconUrl: "",
	},
	{
		id: "moneybux",
		name: "Money Bux",
		description: "Просмотр видео и выполнение заданий за монеты",
		rewardText: "+100 монет за первый вход",
		url: "https://t.me/MoneyBux_bot/app",
		iconUrl: "",
	},
	{
		id: "coinhub",
		name: "CoinHub",
		description: "Мини-игры и конкурсы с ежедневными наградами",
		rewardText: "+50 бонусных монет",
		url: "https://t.me/CoinHub_bot/app",
		iconUrl: "",
	},
] as const;

export type PartnerApp = (typeof partnerApps)[number];

/** Тип для полей промо-кодов (есть только у первого партнёра) */
type PartnerWithPromo = Extract<PartnerApp, { promoCode?: string }>;

/** Скопируй промо-код в буфер обмена */
function copyPromo(code: string) {
	navigator.clipboard.writeText(code).catch(() => {});
}

/** SVG-иконка Earnings Vault — точная копия с Telegram */
function EarningsVaultIcon() {
	return (
		<svg
			width="48"
			height="48"
			viewBox="0 0 120 120"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-label="Earnings Vault"
		>
			{/* Тёмный фон с градиентом */}
			<defs>
				<radialGradient id="evBg" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
					<stop offset="0%" stopColor="#3d2b1f" />
					<stop offset="100%" stopColor="#1a1209" />
				</radialGradient>
				<linearGradient id="evGold" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#f5d76e" />
					<stop offset="50%" stopColor="#d4a017" />
					<stop offset="100%" stopColor="#b8860b" />
				</linearGradient>
				<linearGradient id="evGoldLight" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="#ffd700" />
					<stop offset="100%" stopColor="#daa520" />
				</linearGradient>
			</defs>

			{/* Круглый фон */}
			<circle cx="60" cy="60" r="56" fill="url(#evBg)" stroke="url(#evGold)" strokeWidth="4" />

			{/* Декоративная рамка */}
			<circle cx="60" cy="60" r="50" stroke="url(#evGoldLight)" strokeWidth="1.5" fill="none" opacity="0.6" />
			<circle cx="60" cy="60" r="46" stroke="url(#evGold)" strokeWidth="0.8" fill="none" opacity="0.3" />

			{/* Символ сейфа/кошелька в центре */}
			<rect x="38" y="42" width="44" height="36" rx="4" fill="none" stroke="url(#evGold)" strokeWidth="2.5" />
			<rect x="42" y="46" width="36" height="28" rx="2" fill="none" stroke="url(#evGold)" strokeWidth="1.5" opacity="0.8" />
			
			{/* Круглый замок */}
			<circle cx="60" cy="58" r="6" fill="none" stroke="url(#evGold)" strokeWidth="2" />
			<circle cx="60" cy="58" r="2.5" fill="url(#evGold)" />
			
			{/* Линия ручки */}
			<line x1="60" y1="58" x2="64" y2="62" stroke="url(#evGold)" strokeWidth="1.5" />

			{/* Текст "EARNINGS" сверху */}
			<text x="60" y="34" textAnchor="middle" fill="url(#evGold)" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif">
				EARNINGS
			</text>

			{/* Текст "VAULT" снизу */}
			<text x="60" y="92" textAnchor="middle" fill="url(#evGold)" fontSize="10" fontWeight="bold" fontFamily="Arial, sans-serif">
				VAULT
			</text>

			{/* Декоративные точки по углам */}
			<circle cx="25" cy="25" r="1.5" fill="url(#evGold)" opacity="0.7" />
			<circle cx="95" cy="25" r="1.5" fill="url(#evGold)" opacity="0.7" />
			<circle cx="25" cy="95" r="1.5" fill="url(#evGold)" opacity="0.7" />
			<circle cx="95" cy="95" r="1.5" fill="url(#evGold)" opacity="0.7" />
		</svg>
	);
}

/** Иконка-заглушка: первая буква названия в золотом круге */
function LetterIcon({ name }: { name: string }) {
	const letter = name.charAt(0).toUpperCase();
	return (
		<div className="icon-placeholder" aria-label={name}>
			{letter}
		</div>
	);
}

/** Умная иконка: если iconUrl есть — показываем картинку, иначе — буква,
 * а для Earnings Vault — специальная SVG-иконка.
 * Также проверяем localStorage на наличие загруженной аватарки. */
function SmartIcon({
	app,
}: {
	app: PartnerApp;
}) {
	const [imgLoaded, setImgLoaded] = useState(false);
	const [imgError, setImgError] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);
	const [localAvatar, setLocalAvatar] = useState<string | null>(() =>
		loadAvatar(app.id),
	);

	useEffect(() => {
		if (!app.iconUrl || imgError) return;
		const img = imgRef.current;
		if (!img) return;

		setImgLoaded(false);
		setImgError(false);

		img.src = app.iconUrl;
		img.onload = () => setImgLoaded(true);
		img.onerror = () => setImgError(true);
	}, [app.iconUrl]);

	// Слушаем изменения localStorage (другая вкладка могла удалить аватарку)
	useEffect(() => {
		const handler = () => setLocalAvatar(loadAvatar(app.id));
		window.addEventListener("storage", handler);
		return () => window.removeEventListener("storage", handler);
	}, [app.id]);

	const handleUpload = (dataUrl: string) => {
		saveAvatar(app.id, dataUrl);
		setLocalAvatar(dataUrl);
	};

	const handleRemove = () => {
		removeAvatar(app.id);
		setLocalAvatar(null);
	};

	// Приоритет: загруженная аватарка > iconUrl > заглушка
	if (localAvatar) {
		return (
			<div className="icon-image" aria-label={app.name}>
				<img src={localAvatar} alt={app.name} />
				<AvatarUpload
					appId={app.id}
					currentSrc={localAvatar}
					onUpload={handleUpload}
					onRemove={handleRemove}
				/>
			</div>
		);
	}

	// Специальная иконка для Earnings Vault (только если нет загруженной аватарки)
	if (app.id === "earningsvault") {
		return (
			<div className="icon-image">
				<EarningsVaultIcon />
				<AvatarUpload
					appId={app.id}
					currentSrc={null}
					onUpload={handleUpload}
					onRemove={handleRemove}
				/>
			</div>
		);
	}

	if (!app.iconUrl || imgError) {
		return <LetterIcon name={app.name} />;
	}

	return (
		<div className="icon-image" aria-label={app.name}>
			<img ref={imgRef} src={app.iconUrl} alt={app.name} />
			<AvatarUpload
				appId={app.id}
				currentSrc={app.iconUrl}
				onUpload={handleUpload}
				onRemove={handleRemove}
			/>
		</div>
	);
}

/** Вкладка «Заработок»: карточки Telegram Mini Apps в стиле «Быстрых действий» —
 * тёмное стекло, золотая обводка при наведении, умные иконки, плашка Telegram.
 * Клик по карточке открывает Mini App в Telegram. */
export function PartnersPanel() {
	return (
		<div className="partners glass">
			<div className="partners-head">
				<span className="partners-ico">💰</span>
				<div>
					<div className="partners-title">Заработок</div>
					<div className="partners-sub">
						Telegram Mini Apps — зарабатывай прямо в Telegram, не выходя из приложения
					</div>
				</div>
			</div>

			<div className="partners-grid">
				<AnimatePresence>
					{partnerApps.map((app, i) => {
						const hasPromo = "promoCode" in app && app.promoCode;
						return (
							<motion.a
								key={app.id}
								className="partner-card"
								href={app.url}
								target="_blank"
								rel="noopener noreferrer"
								title={`Открыть ${app.name} в Telegram`}
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.2, delay: i * 0.08 }}
								whileHover={{ y: -3 }}
								whileTap={{ scale: 0.97 }}
							>
								<div className="pc-top">
									<SmartIcon app={app} />
									<span className="tg-badge">✈️ Mini App</span>
								</div>

								<span className="pc-body">
									<span className="pc-title">{app.name}</span>
									<span className="pc-desc">{app.description}</span>
								</span>

								{hasPromo && (
									<div className="pc-promo">
										<span className="pc-promo-label">Промокод:</span>
										<button
											className="pc-promo-code"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												copyPromo(app.promoCode!);
											}}
											title="Скопировать промокод"
										>
											{app.promoCode} 📋
										</button>
										<span className="pc-promo-reward">{app.promoReward}</span>
									</div>
								)}

								{hasPromo && (
									<div className="pc-income">
										<span className="pc-income-ico">💸</span>
										<span>{(app as PartnerWithPromo).incomeInfo}</span>
									</div>
								)}

								<span className="pc-reward">{app.rewardText}</span>

								<span className="pc-go">Открыть →</span>
							</motion.a>
						);
					})}
				</AnimatePresence>
			</div>

			<div className="partners-note">
				💡 Колобок катится по всем дорожкам — выбирай любую и забирай пользу!
				<br />
				<small>Все ссылки откроют Mini App в Telegram.</small>
			</div>
		</div>
	);
}
