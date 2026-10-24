import { useMemo, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const PARALLAX_STRENGTH = 0.04;

export function Background() {
	const stars = useMemo(
		() =>
			Array.from({ length: 90 }, () => ({
				l: Math.random() * 100,
				t: Math.random() * 62,
				s: Math.random() * 2 + 1,
				d: Math.random() * 4,
			})),
		[],
	);
	const flies = useMemo(
		() =>
			Array.from({ length: 10 }, () => ({
				l: 8 + Math.random() * 84,
				t: 30 + Math.random() * 55,
				d: 6 + Math.random() * 8,
				delay: Math.random() * 6,
			})),
		[],
	);

	/* Параллакс-контролы */
	const mx = useMotionValue(0);
	const my = useMotionValue(0);
	const sx = useSpring(mx, { stiffness: 120, damping: 20 });
	const sy = useSpring(my, { stiffness: 120, damping: 20 });

	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const onMove = (e: MouseEvent) => {
			const r = el.getBoundingClientRect();
			mx.set((e.clientX - r.left - r.width / 2) * PARALLAX_STRENGTH);
			my.set((e.clientY - r.top - r.height / 2) * PARALLAX_STRENGTH);
		};
		el.addEventListener("mousemove", onMove);
		return () => el.removeEventListener("mousemove", onMove);
	}, []);

	return (
		<div className="bg" aria-hidden="true" ref={ref}>
			{/* Звёзды — параллакс слой (медленный) */}
			<motion.div style={{ x: sx, y: sy }}>
				{stars.map((st, i) => (
					<span
						key={"s" + i}
						className="star"
						style={{
							left: st.l + "%",
							top: st.t + "%",
							width: st.s + "px",
							height: st.s + "px",
							animationDelay: st.d + "s",
						}}
					/>
				))}
			</motion.div>

			{/* Луна — ещё медленнее */}
			<motion.div className="moon" style={{ x: sx, y: sy }} />

			{/* Огненные мухи — CSS-анимация */}
			{flies.map((f, i) => (
				<span
					key={"f" + i}
					className="firefly"
					style={{
						left: f.l + "%",
						top: f.t + "%",
						animationDuration: f.d + "s",
						animationDelay: f.delay + "s",
					}}
				/>
			))}

			{/* Туман */}
			<div className="mist mist-a" />
			<div className="mist mist-b" />

			{/* Горы — параллакс слой (быстрее звёзд) */}
			<motion.svg
				className="forest"
				viewBox="0 0 1200 220"
				preserveAspectRatio="none"
				style={{ x: sx, y: sy }}
			>
				<path
					fill="#141b3f"
					d="M0 220 L0 150 L40 150 L70 90 L100 150 L150 150 L185 70 L220 150 L280 150 L310 100 L340 150 L400 150 L440 60 L480 150 L540 150 L575 95 L610 150 L670 150 L705 75 L740 150 L800 150 L835 105 L870 150 L930 150 L965 65 L1000 150 L1060 150 L1095 95 L1130 150 L1200 150 L1200 220 Z"
				/>
				<path
					fill="#0a0f28"
					d="M0 220 L0 180 L60 180 L95 120 L130 180 L200 180 L240 100 L280 180 L360 180 L400 130 L440 180 L520 180 L560 90 L600 180 L680 180 L720 125 L760 180 L840 180 L880 105 L920 180 L1000 180 L1040 130 L1080 180 L1160 180 L1200 180 L1200 220 Z"
				/>
			</motion.svg>

			{/* Угловые руны */}
			<div className="corner c-tl" />
			<div className="corner c-tr" />
			<div className="corner c-bl" />
			<div className="corner c-br" />
		</div>
	);
}
