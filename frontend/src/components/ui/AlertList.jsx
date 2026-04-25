import EmptyState from "./EmptyState";
import StatusPill from "./StatusPill";
import { useUiPreferences } from "../../hooks/useUiPreferences";
import { FiCheckCircle } from "react-icons/fi";

export default function AlertList({ alerts, onAcknowledge, canAcknowledge = true }) {
  const { formatDateTime, t } = useUiPreferences();

  if (!alerts.length) {
    return (
      <EmptyState
        icon={FiCheckCircle}
        title={t("alerts.emptyTitle")}
        description={t("alerts.emptyDescription")}
      />
    );
  }

  return (
    <div className="alert-list timeline-list">
      {alerts.map((alert, index) => (
        <article
          key={alert._id || alert.id}
          className="alert-item timeline-item"
          style={{ "--timeline-delay": `${Math.min(index, 6) * 55}ms` }}
        >
          <span className="timeline-node" aria-hidden="true" />
          <div className="alert-item-main">
            <div className="alert-item-header">
              <strong>{alert.message}</strong>
              <StatusPill
                status={alert.status === "acknowledged" ? "normal" : alert.severity}
              />
            </div>
            <p>{t("alerts.metrics", {
              spo2: alert.metrics?.spo2 ?? t("common.notAvailable"),
              bpm: alert.metrics?.bpm ?? t("common.notAvailable"),
            })}</p>
            <small>{formatDateTime(alert.createdAt)}</small>
          </div>
          {canAcknowledge && alert.status !== "acknowledged" ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => onAcknowledge(alert._id || alert.id)}
            >
              {t("alerts.acknowledge")}
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
