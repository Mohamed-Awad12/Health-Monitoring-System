import { useEffect, useState } from "react";
import StatusPill from "./StatusPill";
import { useUiPreferences } from "../../hooks/useUiPreferences";

export default function MetricCard({
  label,
  value,
  unit,
  status,
  statusLabel,
  caption,
  variant = "",
}) {
  const { formatNumber, t } = useUiPreferences();
  const [updating, setUpdating] = useState(false);
  const displayValue =
    typeof value === "number"
      ? formatNumber(value, { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 })
      : value ?? t("common.notAvailable");

  useEffect(() => {
    setUpdating(true);

    const timeoutId = window.setTimeout(() => {
      setUpdating(false);
    }, 420);

    return () => window.clearTimeout(timeoutId);
  }, [displayValue]);

  const cardClassName = variant ? `metric-card ${variant}` : "metric-card";

  return (
    <article className={cardClassName}>
      <div className="metric-card-header">
        <span>{label}</span>
        {status ? <StatusPill status={status} label={statusLabel} /> : null}
      </div>
      <div className={updating ? "metric-card-value is-updating" : "metric-card-value"}>
        <strong>{displayValue}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      <p>{caption}</p>
    </article>
  );
}
