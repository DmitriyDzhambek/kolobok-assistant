type Props = { state: "idle" | "listen" | "think" | "speak" };

export function Kolobok({ state }: Props) {
	return (
		<div className={`kolobok-wrap state-${state}`}>
			<svg
				className="kolobok"
				viewBox="0 0 220 230"
				role="img"
				aria-label="Колобок — голосовой помощник"
			>
				<defs>
					<radialGradient id="kb-body" cx="38%" cy="32%" r="78%">
						<stop offset="0%" stopColor="#fff6cf" />
						<stop offset="45%" stopColor="#ffd766" />
						<stop offset="78%" stopColor="#f0a63a" />
						<stop offset="100%" stopColor="#c07a14" />
					</radialGradient>
					<radialGradient id="kb-aura" cx="50%" cy="50%" r="50%">
						<stop offset="0%" stopColor="#ffd766" stopOpacity="0.5" />
						<stop offset="60%" stopColor="#ffb347" stopOpacity="0.16" />
						<stop offset="100%" stopColor="#ffb347" stopOpacity="0" />
					</radialGradient>
				</defs>

				<circle
					className="aura"
					cx="110"
					cy="112"
					r="100"
					fill="url(#kb-aura)"
				/>
				<circle
					className="ring"
					cx="110"
					cy="112"
					r="82"
					fill="none"
					stroke="#ffd766"
					strokeWidth="2"
				/>

				<g className="spark-orbit">
					{[0, 60, 120, 180, 240, 300].map((a) => (
						<path
							key={a}
							className="spark"
							transform={`rotate(${a} 110 112) translate(110 16)`}
							d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z"
							fill="#ffe9a8"
						/>
					))}
				</g>

				<ellipse cx="110" cy="214" rx="52" ry="9" fill="rgba(0,0,0,0.35)" />

				<g className="body-bob">
					<circle
						cx="110"
						cy="112"
						r="72"
						fill="url(#kb-body)"
						stroke="#a86410"
						strokeWidth="2.5"
					/>
					<path
						d="M52 96 Q60 78 78 68"
						stroke="#e09a34"
						strokeWidth="3"
						fill="none"
						opacity="0.55"
						strokeLinecap="round"
					/>
					<path
						d="M162 132 Q156 150 140 160"
						stroke="#c97b1e"
						strokeWidth="3"
						fill="none"
						opacity="0.5"
						strokeLinecap="round"
					/>
					<path
						d="M64 128 Q60 140 68 150"
						stroke="#e09a34"
						strokeWidth="2.5"
						fill="none"
						opacity="0.4"
						strokeLinecap="round"
					/>

					<g className="eyes">
						<g>
							<ellipse cx="88" cy="100" rx="10.5" ry="12" fill="#fff" />
							<circle cx="89.5" cy="102" r="5.4" fill="#5a3413" />
							<circle cx="91.5" cy="99.5" r="1.8" fill="#fff" />
						</g>
						<g>
							<ellipse cx="132" cy="100" rx="10.5" ry="12" fill="#fff" />
							<circle cx="130.5" cy="102" r="5.4" fill="#5a3413" />
							<circle cx="132.5" cy="99.5" r="1.8" fill="#fff" />
						</g>
					</g>
					<path
						d="M76 84 Q88 78 98 83"
						stroke="#8a5a1a"
						strokeWidth="3"
						fill="none"
						strokeLinecap="round"
					/>
					<path
						d="M122 83 Q132 78 144 84"
						stroke="#8a5a1a"
						strokeWidth="3"
						fill="none"
						strokeLinecap="round"
					/>

					<circle cx="80" cy="122" r="9" fill="#f78e5e" opacity="0.5" />
					<circle cx="140" cy="122" r="9" fill="#f78e5e" opacity="0.5" />
					<circle cx="110" cy="112" r="4" fill="#d97b2e" />

					<path
						className="mouth-smile"
						d="M92 128 Q110 143 128 128"
						stroke="#7a4a12"
						strokeWidth="3.5"
						fill="none"
						strokeLinecap="round"
					/>
					<g className="mouth-talk">
						<ellipse cx="110" cy="132" rx="11" ry="8" fill="#7a3b12" />
						<ellipse cx="110" cy="135" rx="6" ry="3.4" fill="#e2705c" />
					</g>
				</g>
			</svg>
		</div>
	);
}
