const INTRO_PARTICLES = [
  { x: "18%", y: "24%", size: "0.36rem", delay: "0.2s", duration: "5.8s" },
  { x: "28%", y: "68%", size: "0.22rem", delay: "0.7s", duration: "6.4s" },
  { x: "40%", y: "18%", size: "0.28rem", delay: "0.4s", duration: "5.1s" },
  { x: "56%", y: "74%", size: "0.18rem", delay: "1.1s", duration: "6.8s" },
  { x: "64%", y: "28%", size: "0.26rem", delay: "0.3s", duration: "5.6s" },
  { x: "72%", y: "58%", size: "0.34rem", delay: "1.4s", duration: "6.1s" },
  { x: "82%", y: "36%", size: "0.2rem", delay: "0.6s", duration: "5.4s" },
  { x: "14%", y: "54%", size: "0.3rem", delay: "1s", duration: "6.7s" },
  { x: "36%", y: "84%", size: "0.16rem", delay: "1.6s", duration: "7.2s" },
  { x: "50%", y: "10%", size: "0.14rem", delay: "0.9s", duration: "5.3s" },
  { x: "78%", y: "80%", size: "0.24rem", delay: "1.2s", duration: "6.5s" },
  { x: "88%", y: "18%", size: "0.18rem", delay: "0.5s", duration: "5.9s" },
];

export default function IntroSplash({ exiting = false }) {
  return (
    <div className={exiting ? "intro-splash is-exiting" : "intro-splash"}>
      <div className="intro-splash__veil" />
      <div className="intro-splash__halo intro-splash__halo--primary" />
      <div className="intro-splash__halo intro-splash__halo--secondary" />

      {INTRO_PARTICLES.map((particle, index) => (
        <span
          key={`${particle.x}-${particle.y}-${index}`}
          className="intro-splash__particle"
          style={{
            "--particle-x": particle.x,
            "--particle-y": particle.y,
            "--particle-size": particle.size,
            "--particle-delay": particle.delay,
            "--particle-duration": particle.duration,
          }}
          aria-hidden="true"
        />
      ))}

      <div className="intro-splash__core" aria-hidden="true">
        <div className="intro-splash__icon-shell">
          <svg
            className="intro-splash__icon"
            viewBox="0 0 128 128"
            role="presentation"
          >
            <defs>
              <linearGradient id="intro-splash-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22b9ff" />
                <stop offset="100%" stopColor="#2867ff" />
              </linearGradient>
              <filter id="intro-splash-line-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect
              x="16"
              y="16"
              width="96"
              height="96"
              rx="24"
              fill="url(#intro-splash-gradient)"
            />
            <circle className="intro-splash__icon-person" cx="64" cy="42" r="10" />
            <path
              className="intro-splash__icon-line-base"
              d="M28 76h21l11-20 11 34 12-23 8 9h17"
              pathLength="100"
            />
            <path
              className="intro-splash__icon-line-trace"
              d="M28 76h21l11-20 11 34 12-23 8 9h17"
              pathLength="100"
              filter="url(#intro-splash-line-glow)"
            />
          </svg>
        </div>

        <div className="intro-splash__wordmark">
          <span className="intro-splash__typed-text" aria-label="iHealth">
            <span className="intro-splash__wordmark-accent">i</span>
            <span>Health</span>
          </span>
        </div>

        <p className="intro-splash__tagline">YOUR HEALTH, CONNECTED</p>
      </div>
    </div>
  );
}
