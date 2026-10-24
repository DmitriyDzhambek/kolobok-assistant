import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTimeContext, shouldShowGreeting, type TimeContext } from "../utils/timeContext";

export function ProactiveGreeting() {
	const [context, setContext] = useState<TimeContext | null>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!shouldShowGreeting()) return;

		const ctx = getTimeContext();
		setContext(ctx);

		// Показываем с небольшой задержкой для плавности
		const timer = setTimeout(() => {
			setVisible(true);
		}, 1500);

		return () => clearTimeout(timer);
	}, []);

	const handleDismiss = () => {
		setVisible(false);
		// Отмечаем, что приветствие показано
		sessionStorage.setItem("kolobok-greeting-shown", "true");
	};

	return (
		<AnimatePresence>
			{visible && context && (
				<motion.div
					className="proactive-greeting"
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, height: 0, marginBottom: 0 }}
					transition={{ duration: 0.5, ease: "easeOut" }}
				>
					{/* Бейдж времени суток */}
					<div className="pg-badge">{context.badge}</div>

					{/* Контент приветствия */}
					<div className="pg-content">
						<div className="pg-kolobok">🫓</div>
						<div className="pg-text">
							<p className="pg-message">{context.greeting}</p>
							{context.foodSuggestion && (
								<p className="pg-hint">
									💡 Предлагаю: <strong>{context.foodSuggestion}</strong>
								</p>
							)}
						</div>
					</div>

					{/* Кнопка закрытия */}
					<button
						className="pg-close"
						onClick={handleDismiss}
						title="Скрыть приветствие"
						aria-label="Скрыть"
					>
						✕
					</button>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
