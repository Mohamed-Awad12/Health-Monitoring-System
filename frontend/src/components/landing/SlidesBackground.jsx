import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 56;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function SlidesBackground({ progressRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d", { alpha: true });

    if (!context) {
      return undefined;
    }

    let width = 0;
    let height = 0;
    let animationFrameId = 0;
    let lastTimestamp = 0;

    const particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.0003 + Math.random() * 0.00045,
      radius: 1 + Math.random() * 2.4,
      orbit: 0.16 + Math.random() * 0.44,
      alpha: 0.16 + Math.random() * 0.34,
      offsetX: Math.random() * 2 - 1,
      offsetY: Math.random() * 2 - 1,
      drift: 0.4 + index / PARTICLE_COUNT,
    }));

    const resize = () => {
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (timestamp) => {
      const delta = lastTimestamp ? timestamp - lastTimestamp : 16;
      lastTimestamp = timestamp;

      const progress = clamp(progressRef?.current ?? 0, 0, 1);
      const hueA = 205 + progress * 18;
      const hueB = 164 + progress * 24;
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, `hsla(${hueA}, 62%, 8%, 0.96)`);
      gradient.addColorStop(0.5, `hsla(${hueA - 10}, 58%, 12%, 0.92)`);
      gradient.addColorStop(1, `hsla(${hueB}, 56%, 10%, 0.96)`);

      context.clearRect(0, 0, width, height);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const glowX = width * (0.2 + progress * 0.55);
      const glowY = height * (0.22 + progress * 0.18);
      const glow = context.createRadialGradient(glowX, glowY, 0, glowX, glowY, width * 0.42);
      glow.addColorStop(0, `hsla(${195 + progress * 25}, 100%, 68%, 0.17)`);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.angle += particle.speed * delta * (1 + progress * 1.8);

        const orbitX = width * (0.32 + particle.offsetX * 0.22);
        const orbitY = height * (0.42 + particle.offsetY * 0.18);
        const x =
          orbitX +
          Math.cos(particle.angle * particle.drift) * width * particle.orbit +
          Math.sin(timestamp * 0.00012 + particle.offsetY) * 12;
        const y =
          orbitY +
          Math.sin(particle.angle) * height * particle.orbit * 0.72 +
          Math.cos(timestamp * 0.00016 + particle.offsetX) * 10;

        context.beginPath();
        context.fillStyle = `hsla(${188 + progress * 32}, 88%, 74%, ${
          particle.alpha * (0.7 + progress * 0.35)
        })`;
        context.arc(x, y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });

      animationFrameId = window.requestAnimationFrame(draw);
    };

    resize();
    animationFrameId = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [progressRef]);

  return (
    <div className="slides-background" aria-hidden="true">
      <canvas ref={canvasRef} className="slides-background-canvas" />
      <div className="slides-background-grid" />
      <div className="slides-background-vignette" />
    </div>
  );
}
