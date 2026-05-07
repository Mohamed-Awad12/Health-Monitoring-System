import { useState } from "react";
import EmptyState from "./EmptyState";
import StatusPill from "./StatusPill";
import { useUiPreferences } from "../../hooks/useUiPreferences";
import { FiCheckCircle } from "react-icons/fi";

export default function AlertList({
  alerts,
  onAcknowledge,
  onSaveNote,
  canAcknowledge = true,
}) {
  const { formatDateTime, t } = useUiPreferences();
  const [openNoteId, setOpenNoteId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNoteId, setSavingNoteId] = useState("");

  const handleSaveNote = async (alert) => {
    const alertId = alert._id || alert.id;
    const note = String(noteDrafts[alertId] || "").trim();

    if (!note || !onSaveNote) {
      return;
    }

    setSavingNoteId(alertId);

    try {
      await onSaveNote(alertId, note);
      setOpenNoteId("");
      setNoteDrafts((currentDrafts) => ({
        ...currentDrafts,
        [alertId]: "",
      }));
    } finally {
      setSavingNoteId("");
    }
  };

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
      {alerts.map((alert, index) => {
        const alertId = alert._id || alert.id;
        const canEditNote =
          canAcknowledge &&
          onSaveNote &&
          alert.status !== "acknowledged" &&
          !alert.doctorNote;
        const noteEditorOpen = openNoteId === alertId;

        return (
          <article
            key={alertId}
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

              {alert.doctorNote ? (
                <div className="alert-note-readonly">
                  <strong>{alert.doctorNote}</strong>
                  {alert.notedAt ? (
                    <small>
                      {t("alerts.notedAt", {
                        date: formatDateTime(alert.notedAt),
                      })}
                    </small>
                  ) : null}
                </div>
              ) : null}

              {canEditNote ? (
                <div className="alert-note-editor">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setOpenNoteId(noteEditorOpen ? "" : alertId)}
                  >
                    {t("alerts.addNote")}
                  </button>

                  {noteEditorOpen ? (
                    <div className="alert-note-form">
                      <textarea
                        value={noteDrafts[alertId] || ""}
                        maxLength={500}
                        placeholder={t("alerts.notePlaceholder")}
                        onChange={(event) =>
                          setNoteDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [alertId]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          savingNoteId === alertId ||
                          !String(noteDrafts[alertId] || "").trim()
                        }
                        onClick={() => handleSaveNote(alert)}
                      >
                        {savingNoteId === alertId
                          ? t("common.loading")
                          : t("alerts.saveNote")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {canAcknowledge && alert.status !== "acknowledged" ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => onAcknowledge(alertId)}
              >
                {t("alerts.acknowledge")}
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
