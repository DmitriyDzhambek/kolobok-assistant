import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	loadPartners,
	savePartners,
	loadAvatar,
	saveAvatar,
	removeAvatar,
	subscribePartners,
	type Partner,
} from "../storage/partners";
import { useAdminAuth } from "../auth/admin";

/* ------------------------------------------------------------------ */
/* Аватарка админа                                                     */
/* ------------------------------------------------------------------ */

const ADMIN_AVATAR_KEY = "admin-avatar";

function loadAdminAvatar(): string | null {
	try {
		return localStorage.getItem(ADMIN_AVATAR_KEY);
	} catch {
		return null;
	}
}

function saveAdminAvatar(dataUrl: string) {
	try {
		localStorage.setItem(ADMIN_AVATAR_KEY, dataUrl);
	} catch {
		/* noop */
	}
}

function AdminAvatar({
	avatar,
	onUpload,
}: {
	avatar: string | null;
	onUpload: (dataUrl: string) => void;
}) {
	const [isHovered, setIsHovered] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 1024 * 1024) {
			alert("Файл слишком большой. Максимум 1 МБ.");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
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
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	return (
		<div
			className="admin-avatar-wrap"
			onPointerEnter={() => setIsHovered(true)}
			onPointerLeave={() => setIsHovered(false)}
		>
			{avatar ? (
				<div className="admin-avatar-circle">
					<img src={avatar} alt="Админ" className="admin-avatar-img" />
					{isHovered && (
						<div className="admin-avatar-overlay">
							<button
								className="admin-avatar-btn"
								onClick={() => {
									saveAdminAvatar("");
									window.location.reload();
								}}
								title="Удалить аватарку"
							>
								✕
							</button>
						</div>
					)}
				</div>
			) : (
				<div
					className="admin-avatar-placeholder"
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
			{isHovered && !avatar && (
				<div className="admin-avatar-tooltip">Загрузить</div>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Аватарка партнёра (в форме редактирования)                           */
/* ------------------------------------------------------------------ */

function PartnerAvatarField({
	partnerId,
	avatar,
	onSave,
	onRemove,
}: {
	partnerId: string;
	avatar: string | null;
	onSave: (dataUrl: string) => void;
	onRemove: () => void;
}) {
	const [isHovered, setIsHovered] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 1024 * 1024) {
			alert("Файл слишком большой. Максимум 1 МБ.");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
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
				onSave(compressed);
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	return (
		<div className="admin-form-avatar">
			<label>Аватарка партнёра</label>
			<div
				className="admin-form-avatar-wrap"
				onPointerEnter={() => setIsHovered(true)}
				onPointerLeave={() => setIsHovered(false)}
			>
				{avatar ? (
					<div className="admin-form-avatar-circle">
						<img src={avatar} alt="Аватар" className="admin-form-avatar-img" />
						{isHovered && (
							<button
								className="admin-form-avatar-remove"
								onClick={onRemove}
								title="Удалить аватарку"
							>
								✕
							</button>
						)}
					</div>
				) : (
					<div
						className="admin-form-avatar-placeholder"
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
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Форма добавления / редактирования партнёра                           */
/* ------------------------------------------------------------------ */

type PartnerEdit = {
	id: string;
	name: string;
	description: string;
	rewardText: string;
	url: string;
	iconUrl: string;
	promoCode?: string;
	promoReward?: string;
	incomeInfo?: string;
};

function PartnerForm({
	partner,
	onSave,
	onCancel,
}: {
	partner: PartnerEdit | null;
	onSave: (p: PartnerEdit) => void;
	onCancel: () => void;
}) {
	const [form, setForm] = useState<PartnerEdit>(
		partner || {
			id: `partner-${Date.now()}`,
			name: "",
			description: "",
			rewardText: "",
			url: "",
			iconUrl: "",
			promoCode: "",
			promoReward: "",
			incomeInfo: "",
		},
	);
	const [partnerAvatar, setPartnerAvatar] = useState(
		() => loadAvatar(form.id),
	);

	useEffect(() => {
		setPartnerAvatar(loadAvatar(form.id));
	}, [form.id]);

	const handleChange = (field: keyof PartnerEdit, value: string) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!form.name.trim() || !form.url.trim()) {
			alert("Заполните название и ссылку");
			return;
		}
		onSave(form);
	};

	return (
		<form className="admin-form" onSubmit={handleSubmit}>
			<div className="admin-form-title">
				{partner ? "✏️ Редактировать партнёра" : "➕ Добавить партнёра"}
			</div>

			<PartnerAvatarField
				partnerId={form.id}
				avatar={partnerAvatar}
				onSave={(dataUrl) => {
					saveAvatar(form.id, dataUrl);
					setPartnerAvatar(dataUrl);
				}}
				onRemove={() => {
					removeAvatar(form.id);
					setPartnerAvatar(null);
				}}
			/>

			<div className="admin-form-row">
				<label>Название *</label>
				<input
					value={form.name}
					onChange={(e) => handleChange("name", e.target.value)}
					placeholder="Earnings Vault"
					required
				/>
			</div>

			<div className="admin-form-row">
				<label>Описание</label>
				<input
					value={form.description}
					onChange={(e) => handleChange("description", e.target.value)}
					placeholder="Хранилище заработка"
				/>
			</div>

			<div className="admin-form-row">
				<label>Ссылка на Mini App *</label>
				<input
					value={form.url}
					onChange={(e) => handleChange("url", e.target.value)}
					placeholder="https://t.me/Earnings_Vault"
					required
				/>
			</div>

			<div className="admin-form-row">
				<label>Текст награды</label>
				<input
					value={form.rewardText}
					onChange={(e) => handleChange("rewardText", e.target.value)}
					placeholder="+5% бонус за регистрацию"
				/>
			</div>

			<div className="admin-form-row">
				<label>Ссылка на иконку (URL)</label>
				<input
					value={form.iconUrl}
					onChange={(e) => handleChange("iconUrl", e.target.value)}
					placeholder="https://..."
				/>
			</div>

			<div className="admin-form-divider" />
			<div className="admin-form-title-small">Промокод (опционально)</div>

			<div className="admin-form-row">
				<label>Промокод</label>
				<input
					value={form.promoCode}
					onChange={(e) => handleChange("promoCode", e.target.value)}
					placeholder="KOL0B0K"
				/>
			</div>

			<div className="admin-form-row">
				<label>Награда за промокод</label>
				<input
					value={form.promoReward}
					onChange={(e) => handleChange("promoReward", e.target.value)}
					placeholder="5% бонус при регистрации"
				/>
			</div>

			<div className="admin-form-row">
				<label>Информация о доходе</label>
				<input
					value={form.incomeInfo}
					onChange={(e) => handleChange("incomeInfo", e.target.value)}
					placeholder="Доход от 50₽/день — задания, рефералы"
				/>
			</div>

			<div className="admin-form-actions">
				<button type="submit" className="admin-btn-save">💾 Сохранить</button>
				<button type="button" className="admin-btn-cancel" onClick={onCancel}>✕ Отмена</button>
			</div>
		</form>
	);
}

/* ------------------------------------------------------------------ */
/* Список партнёров (редактируемый)                                     */
/* ------------------------------------------------------------------ */

function PartnersList({
	partners,
	onEdit,
	onDelete,
	onAdd,
}: {
	partners: PartnerEdit[];
	onEdit: (p: PartnerEdit) => void;
	onDelete: (id: string) => void;
	onAdd: () => void;
}) {
	return (
		<div className="admin-partners-list">
			<div className="admin-partners-header">
				<span>📋 Список партнёров ({partners.length})</span>
				<button className="admin-btn-add" onClick={onAdd}>
					➕ Добавить
				</button>
			</div>

			<div className="admin-partners-grid">
				{partners.map((p, i) => (
					<motion.div
						key={p.id}
						className="admin-partner-card"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: i * 0.05 }}
					>
						<div className="admin-partner-top">
							{loadAvatar(p.id) ? (
								<img
									src={loadAvatar(p.id)!}
									alt={p.name}
									className="admin-partner-icon"
								/>
							) : p.iconUrl ? (
								<img src={p.iconUrl} alt={p.name} className="admin-partner-icon" />
							) : (
								<div className="admin-partner-icon-placeholder">
									{p.name.charAt(0).toUpperCase()}
								</div>
							)}
							<div className="admin-partner-info">
								<div className="admin-partner-name">{p.name}</div>
								<div className="admin-partner-desc">{p.description}</div>
								<div className="admin-partner-url">{p.url}</div>
							</div>
						</div>

						{p.promoCode && (
							<div className="admin-partner-promo">
								Промо: <b>{p.promoCode}</b>
								{p.promoReward && ` — ${p.promoReward}`}
							</div>
						)}

						{p.incomeInfo && (
							<div className="admin-partner-income">💸 {p.incomeInfo}</div>
						)}

						<div className="admin-partner-actions">
							<button
								className="admin-btn-edit"
								onClick={() => onEdit(p)}
								title="Редактировать"
							>
								✏️
							</button>
							<button
								className="admin-btn-delete"
								onClick={() => {
									if (confirm(`Удалить ${p.name}?`)) onDelete(p.id);
								}}
								title="Удалить"
							>
								🗑️
							</button>
						</div>
					</motion.div>
				))}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Экраны авторизации                                                   */
/* ------------------------------------------------------------------ */

function AccessDenied() {
	return (
		<div className="admin-login">
		 <div className="admin-login-card admin-login-error">
				<div className="admin-login-ico">🔒</div>
				<div className="admin-login-text">
					Доступ к админ-панели закрыт.
					<br />
					<small>Войдите через Telegram Mini App или используйте секретную ссылку: <code>?kolobok-admin=СЕКРЕТ</code></small>
				</div>
			</div>
		</div>
	);
}

/** Админ-панель для управления партнёрами */
export function AdminPanel() {
	const { isAdmin, user } = useAdminAuth();

	const [partners, setPartners] = useState<Partner[]>(loadPartners);
	const [editingPartner, setEditingPartner] = useState<PartnerEdit | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [adminAvatar, setAdminAvatar] = useState<string | null>(loadAdminAvatar);

	// Реактивное обновление списка из других вкладок
	useEffect(() => subscribePartners(() => setPartners(loadPartners())), []);

	const handleSavePartner = (p: PartnerEdit) => {
		const updated = partners.map((old) => (old.id === p.id ? p : old));
		if (!partners.find((old) => old.id === p.id)) {
			updated.push(p);
		}
		setPartners(updated);
		savePartners(updated);
		setShowForm(false);
		setEditingPartner(null);
	};

	const handleDeletePartner = (id: string) => {
		const updated = partners.filter((p) => p.id !== id);
		setPartners(updated);
		savePartners(updated);
	};

	const handleEditPartner = (p: PartnerEdit) => {
		setEditingPartner(p);
		setShowForm(true);
	};

	const handleAddPartner = () => {
		setEditingPartner(null);
		setShowForm(true);
	};

	if (!isAdmin) {
		return <AccessDenied />;
	}

	return (
		<div className="admin-panel glass">
			<div className="admin-header">
				<AdminAvatar avatar={adminAvatar} onUpload={saveAdminAvatar} />
				<div className="admin-user-info">
					<div className="admin-user-name">👑 Админ-панель</div>
					<div className="admin-user-sub">
						{user?.first_name || "Админ"} · {user?.username || "Владелец"}
					</div>
				</div>
				<button
					className="admin-btn-logout"
					onClick={() => window.location.reload()}
					title="Выйти"
				>
					🚪
				</button>
			</div>

			<AnimatePresence>
				{showForm ? (
					<motion.div
						key="form"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
					>
						<PartnerForm
							partner={editingPartner}
							onSave={handleSavePartner}
							onCancel={() => {
								setShowForm(false);
								setEditingPartner(null);
							}}
						/>
					</motion.div>
				) : (
					<motion.div
						key="list"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<PartnersList
							partners={partners}
							onEdit={handleEditPartner}
							onDelete={handleDeletePartner}
							onAdd={handleAddPartner}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			<div className="admin-note">
				💡 Все изменения сохраняются локально в браузере.
				<br />
				<small>Для публикации изменений на сервере — используйте Git.</small>
			</div>
		</div>
	);
}
