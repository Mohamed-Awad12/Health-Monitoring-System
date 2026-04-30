import { useUiPreferences } from "../../hooks/useUiPreferences";

export default function StatusPill({ status, label }) {
  const { t } = useUiPreferences();
  const displayLabel = label || t(`status.${status}`);

  return (
    <span className={`status-pill status-pill-${status}`} role="status" aria-label={displayLabel}>
      {displayLabel}
    </span>
  );
}

