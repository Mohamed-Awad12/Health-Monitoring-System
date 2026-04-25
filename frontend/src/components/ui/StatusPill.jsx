import { useUiPreferences } from "../../hooks/useUiPreferences";

export default function StatusPill({ status, label }) {
  const { t } = useUiPreferences();

  return (
    <span className={`status-pill status-pill-${status}`}>
      {label || t(`status.${status}`)}
    </span>
  );
}
