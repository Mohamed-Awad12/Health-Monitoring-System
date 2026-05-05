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
          <img
            className="intro-splash__icon"
            src="/favicon.svg"
            alt=""
            width="112"
            height="112"
          />
        </div>

        <div className="intro-splash__wordmark">
          <span className="intro-splash__wordmark-accent">Pulse</span>
          <span> Oximeter</span>
        </div>

        <p className="intro-splash__tagline">SMART MONITORING, CONNECTED CARE</p>
      </div>
    </div>
  );
}
