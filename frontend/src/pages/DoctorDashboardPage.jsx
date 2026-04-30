import { useEffect, useState } from "react";
import {
  acknowledgeDoctorAlert,
  approveDoctorAssignment,
  denyDoctorAssignment,
  getAssignedPatients,
  getDoctorPatientAlerts,
  getDoctorPatientDashboard,
} from "../api/doctorApi";
import VitalChart from "../components/charts/VitalChart";
import AppShell from "../components/layout/AppShell";
import AlertList from "../components/ui/AlertList";
import EmptyState from "../components/ui/EmptyState";
import MetricCard from "../components/ui/MetricCard";
import RangeTabs from "../components/ui/RangeTabs";
import SectionCard from "../components/ui/SectionCard";
import {
  AlertListSkeleton,
  OverviewSkeleton,
  PatientListSkeleton,
  StatusCardListSkeleton,
} from "../components/ui/Skeleton";
import StatusPill from "../components/ui/StatusPill";
import { useSocket } from "../hooks/useSocket";
import { useToast } from "../hooks/useToast";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { FiUsers, FiUserCheck, FiInbox } from "react-icons/fi";

const getStatusFromReading = (reading, openAlertCount = 0) => {
  if (openAlertCount > 0) {
    return "critical";
  }

  if (!reading) {
    return "warning";
  }

  return "normal";
};

export default function DoctorDashboardPage() {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const { formatDateTime, formatNumber, t } = useUiPreferences();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("day");
  const [patients, setPatients] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [decisionLoadingId, setDecisionLoadingId] = useState("");
  const [error, setError] = useState("");

  const loadPatients = async (searchValue = search) => {
    const response = await getAssignedPatients(searchValue);
    const nextPatients = response.data.patients || [];
    const nextPendingAssignments = response.data.pendingAssignments || [];

    setPatients(nextPatients);
    setPendingAssignments(nextPendingAssignments);
    setSelectedPatientId((currentSelectedPatientId) => {
      if (!currentSelectedPatientId) {
        return nextPatients[0]?._id || "";
      }

      return nextPatients.find((patient) => patient._id === currentSelectedPatientId)
        ? currentSelectedPatientId
        : nextPatients[0]?._id || "";
    });
  };

  const loadSelectedPatient = async (patientId = selectedPatientId, selectedRange = range) => {
    if (!patientId) {
      setDashboardLoading(false);
      setDashboard(null);
      setAlerts([]);
      return;
    }

    setDashboardLoading(true);

    try {
      const [dashboardResponse, alertsResponse] = await Promise.all([
        getDoctorPatientDashboard(patientId, selectedRange),
        getDoctorPatientAlerts(patientId, "all"),
      ]);

      setDashboard(dashboardResponse.data);
      setAlerts(alertsResponse.data.alerts);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError("");

    loadPatients(search)
      .catch((requestError) => {
        setError(requestError.response?.data?.message || t("doctor.patientsLoadFailed"));
      })
      .finally(() => setLoading(false));
  }, [search, t]);

  useEffect(() => {
    loadSelectedPatient(selectedPatientId, range).catch((requestError) => {
      setError(requestError.response?.data?.message || t("doctor.patientDataLoadFailed"));
    });
  }, [selectedPatientId, range, t]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const refreshCurrentPatient = (payload) => {
      if (!payload.patientId) {
        return;
      }

      loadPatients(search).catch(() => {});

      if (payload.patientId.toString() === selectedPatientId.toString()) {
        loadSelectedPatient(selectedPatientId, range).catch(() => {});
      }
    };

    socket.on("reading:new", refreshCurrentPatient);
    socket.on("alert:new", refreshCurrentPatient);

    return () => {
      socket.off("reading:new", refreshCurrentPatient);
      socket.off("alert:new", refreshCurrentPatient);
    };
  }, [socket, search, selectedPatientId, range]);

  const handleAcknowledge = async (alertId) => {
    try {
      await acknowledgeDoctorAlert(alertId);
      await loadSelectedPatient(selectedPatientId, range);
      await loadPatients(search);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("doctor.acknowledgeFailed"));
    }
  };

  const handleAssignmentDecision = async (assignmentId, decision, patientId) => {
    setDecisionLoadingId(`${decision}:${assignmentId}`);
    setError("");

    try {
      if (decision === "approve") {
        await approveDoctorAssignment(assignmentId);
        addToast({ type: "success", message: t("doctor.approvedSuccessfully") });
      } else {
        await denyDoctorAssignment(assignmentId);
        addToast({ type: "success", message: t("doctor.deniedSuccessfully") });
      }

      await loadPatients(search);

      if (decision === "approve") {
        setSelectedPatientId(patientId);
        await loadSelectedPatient(patientId, range);
      } else {
        await loadSelectedPatient(selectedPatientId, range);
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (decision === "approve" ? t("doctor.approveFailed") : t("doctor.denyFailed"))
      );
    } finally {
      setDecisionLoadingId("");
    }
  };

  return (
    <AppShell
      title={t("doctor.dashboardTitle")}
      subtitle={t("doctor.dashboardSubtitle")}
      actions={
        <>
          <div className="profile-alert">
            <strong>{formatNumber(pendingAssignments.length)}</strong>
            <span>{t("doctor.pendingRequestsCount")}</span>
          </div>
          <div className="profile-alert">
            <strong>{formatNumber(patients.length)}</strong>
            <span>{t("doctor.assignedPatientsCount")}</span>
          </div>
        </>
      }
    >
      {error && !loading ? <div className="form-error page-feedback" role="alert">{error}</div> : null}

      <div className="doctor-layout">
        <aside className="patient-list-panel">
          <SectionCard
            id="doctor-requests"
            title={t("doctor.pendingRequests")}
            className="requests-section"
          >
            {loading ? (
              <StatusCardListSkeleton
                label={t("doctor.loadingPatients")}
                className="request-review-card"
                showActions
              />
            ) : !pendingAssignments.length ? (
              <EmptyState
                icon={FiUserCheck}
                title={t("doctor.noPendingRequestsTitle")}
                description={t("doctor.noPendingRequestsDescription")}
              />
            ) : (
              <div className="request-review-list">
                {pendingAssignments.map((assignment) => {
                  const pendingDecisionKey = `approve:${assignment.assignmentId}`;
                  const deniedDecisionKey = `deny:${assignment.assignmentId}`;

                  return (
                    <article key={assignment.assignmentId} className="request-review-card">
                      <div className="status-detail-header">
                        <div>
                          <strong>{assignment.name}</strong>
                          <span>{assignment.email}</span>
                        </div>
                        <StatusPill status="pending" />
                      </div>

                      <p>{t("doctor.requestCardDescription")}</p>
                      <small>
                        {t("common.requestedAt", {
                          date: formatDateTime(assignment.requestedAt),
                        })}
                      </small>
                      <small>
                        {t("alerts.metrics", {
                          spo2: assignment.latestReading?.spo2 ?? t("common.notAvailable"),
                          bpm: assignment.latestReading?.bpm ?? t("common.notAvailable"),
                        })}
                      </small>

                      <div className="button-row">
                        <button
                          className="primary-button"
                          type="button"
                          disabled={Boolean(decisionLoadingId)}
                          onClick={() =>
                            handleAssignmentDecision(
                              assignment.assignmentId,
                              "approve",
                              assignment._id
                            )
                          }
                        >
                          {decisionLoadingId === pendingDecisionKey
                            ? t("common.loading")
                            : t("doctor.approve")}
                        </button>
                        <button
                          className="ghost-button danger"
                          type="button"
                          disabled={Boolean(decisionLoadingId)}
                          onClick={() =>
                            handleAssignmentDecision(
                              assignment.assignmentId,
                              "deny",
                              assignment._id
                            )
                          }
                        >
                          {decisionLoadingId === deniedDecisionKey
                            ? t("common.loading")
                            : t("doctor.deny")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            id="doctor-patients"
            title={t("doctor.assignedPatients")}
            className="patients-section"
          >
            <label className="search-label">
              {t("doctor.searchPatients")}
              <input
                type="text"
                placeholder={t("doctor.searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            {loading ? (
              <PatientListSkeleton label={t("doctor.loadingPatients")} />
            ) : !patients.length ? (
              <EmptyState
                icon={FiUsers}
                title={t("doctor.noAssignedPatientsTitle")}
                description={t("doctor.noAssignedPatientsDescription")}
              />
            ) : (
              <div className="patient-list">
                {patients.map((patient) => (
                  <button
                    key={patient._id}
                    type="button"
                    className={
                      selectedPatientId === patient._id
                        ? "patient-list-item active"
                        : "patient-list-item"
                    }
                    onClick={() => setSelectedPatientId(patient._id)}
                  >
                    <div>
                      <strong>{patient.name}</strong>
                      <span>{patient.email}</span>
                    </div>
                    <div className="patient-list-metrics">
                      <small>
                        {patient.latestReading
                          ? t("alerts.metrics", {
                              spo2: patient.latestReading.spo2,
                              bpm: patient.latestReading.bpm,
                            })
                          : t("doctor.noReadings")}
                      </small>
                      <StatusPill
                        status={getStatusFromReading(
                          patient.latestReading,
                          patient.openAlertCount
                        )}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </aside>

        <div className="dashboard-main">
          <SectionCard
            id="doctor-overview"
            title={t("doctor.selectedPatientOverview")}
            actions={<RangeTabs value={range} onChange={setRange} />}
            className="spotlight-section"
          >
            {loading || dashboardLoading ? (
              <OverviewSkeleton
                label={t("doctor.loadingPatientDashboard")}
                metricVariants={[
                  "live-spo2-card",
                  "live-bpm-card",
                  "alert-metric-card",
                  "sample-metric-card",
                ]}
              />
            ) : !selectedPatientId ? (
              <EmptyState
                icon={FiInbox}
                title={t("doctor.selectPatientTitle")}
                description={t("doctor.selectPatientDescription")}
              />
            ) : !dashboard ? (
              <div className="form-error">{error || t("doctor.patientDataLoadFailed")}</div>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard
                    label={t("doctor.currentOxygen")}
                    value={dashboard.latestReading?.spo2}
                    unit="%"
                    status={getStatusFromReading(
                      dashboard.latestReading,
                      dashboard.openAlertCount
                    )}
                    caption={t("patient.latestOxygen")}
                    variant="live-spo2-card"
                  />
                  <MetricCard
                    label={t("doctor.currentHeartRate")}
                    value={dashboard.latestReading?.bpm}
                    unit="bpm"
                    status={getStatusFromReading(
                      dashboard.latestReading,
                      dashboard.openAlertCount
                    )}
                    caption={t("patient.latestHeartRate")}
                    variant="live-bpm-card"
                  />
                  <MetricCard
                    label={t("common.openAlerts")}
                    value={dashboard.openAlertCount || 0}
                    status={dashboard.openAlertCount ? "critical" : "normal"}
                    caption={t("doctor.openAlertsCaption")}
                    variant="alert-metric-card"
                  />
                  <MetricCard
                    label={t("common.samples")}
                    value={dashboard.summary?.totalReadings || 0}
                    status="normal"
                    caption={t("doctor.samplesCaption")}
                    variant="sample-metric-card"
                  />
                </div>

                <VitalChart data={dashboard.series} />
              </>
            )}
          </SectionCard>

          <SectionCard
            id="doctor-alerts"
            title={t("doctor.patientAlerts")}
            className="history-section"
          >
            {loading || dashboardLoading ? (
              <AlertListSkeleton label={t("doctor.loadingPatientDashboard")} />
            ) : (
              <AlertList alerts={alerts} onAcknowledge={handleAcknowledge} />
            )}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
