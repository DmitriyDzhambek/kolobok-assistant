/**
 * FirefliesCanvas — лёгкая canvas-анимация золотых светлячков.
 * Частицы медленно дрейфуют, отталкиваются от курсора и мерцают.
 */
import { useEffect, useRef } from "react";
import { motion, useMotionValue } from "framer-motion";

const PARTICLE_COUNT = 28;
const DRIFT_SPEED = 0.15;
const REPEL_RADIUS = 120;
const REPEL_FORCE = 2.5;
const TWINKLE_SPEED = 0.02;

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	baseAlpha: number;
	twinklePhase: number;
}

export function FirefliesCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const particlesRef = useRef<Particle[]>([]);
	const mouse = useRef({ x: -9999, y: -9999 });
	const rafRef = useRef(0);

	/* Спрайны для плавной передачи мыши в RAF */
	const mx = useMotionValue(-9999);
	const my = useMotionValue(-9999);
	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			mx.set(e.clientX);
			my.set(e.clientY);
		};
		window.addEventListener("mousemove", onMove);
		return () => window.removeEventListener("mousemove", onMove);
	}, []);

	useEffect(() => {
		let mX = -9999;
		let mY = -9999;
		const unsubX = mx.onChange((v) => { mX = v; mouse.current.x = v; });
		const unsubY = my.onChange((v) => { mY = v; mouse.current.y = v; });

		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		/* Инициализация частиц */
		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			const w = window.innerWidth;
			const h = window.innerHeight;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			canvas.style.width = w + "px";
			canvas.style.height = h + "px";
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		window.addEventListener("resize", resize);

		if (particlesRef.current.length === 0) {
			for (let i = 0; i < PARTICLE_COUNT; i++) {
				particlesRef.current.push({
					x: Math.random() * window.innerWidth,
					y: Math.random() * window.innerHeight,
					vx: (Math.random() - 0.5) * DRIFT_SPEED,
					vy: (Math.random() - 0.5) * DRIFT_SPEED,
					r: Math.random() * 3 + 1.5,
					baseAlpha: Math.random() * 0.5 + 0.3,
					twinklePhase: Math.random() * Math.PI * 2,
				});
			}
		}

		let t = 0;
		const tick = () => {
			t += TWINKLE_SPEED;
			const w = window.innerWidth;
			const h = window.innerHeight;
			ctx.clearRect(0, 0, w, h);

			for (const p of particlesRef.current) {
				/* Дрейф */
				p.x += p.vx + Math.sin(t + p.twinklePhase) * 0.08;
				p.y += p.vy + Math.cos(t * 0.7 + p.twinklePhase) * 0.06;

				/* Границы — мягкий отскок */
				if (p.x < -20) p.x = w + 20;
				if (p.x > w + 20) p.x = -20;
				if (p.y < -20) p.y = h + 20;
				if (p.y > h + 20) p.y = -20;

				/* Реакция на курсор */
				const dx = p.x - mX;
				const dy = p.y - mY;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < REPEL_RADIUS && dist > 0) {
					const force = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
					p.vx += (dx / dist) * force * 0.05;
					p.vy += (dy / dist) * force * 0.05;
				}

				/* Затухание скорости */
				p.vx *= 0.98;
				p.vy *= 0.98;

				/* Мерцание */
				const alpha = p.baseAlpha * (0.5 + 0.5 * Math.sin(t * 3 + p.twinklePhase));

				/* Рисование */
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(255, 233, 168, ${alpha})`;
				ctx.fill();

				/* Свечение */
				if (p.r > 2) {
					ctx.beginPath();
					ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(255, 215, 102, ${alpha * 0.25})`;
					ctx.fill();
				}
			}

			rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(rafRef.current);
			window.removeEventListener("resize", resize);
			unsubX();
			unsubY();
		};
	}, [mx, my]);

	return (
		<motion.canvas
			ref={canvasRef}
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 1,
				pointerEvents: "none",
			}}
		/>
	);
}
