import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useUiPreferences } from "../../hooks/useUiPreferences";

export default function AnimatedCounter({
  value,
  suffix = "",
  duration = 1.8,
  decimals = 0,
}) {
  const { formatNumber } = useUiPreferences();
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    amount: 0.55,
  });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) {
      return undefined;
    }

    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        const rounded = Number(latest.toFixed(decimals));
        setDisplayValue(rounded);
      },
    });

    return () => controls.stop();
  }, [decimals, duration, isInView, value]);

  return (
    <span ref={ref}>
      {formatNumber(displayValue, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
