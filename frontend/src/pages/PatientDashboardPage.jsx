import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  acknowledgePatientAlert,
  assignDoctor,
  downloadPatientReport,
  generatePatientAssistantReport,
  getDoctors,
  getPatientAlerts,
  getPatientDashboard,
  linkDevice,
  unassignDoctor,
} from "../api/patientApi";
import AppShell from "../components/layout/AppShell";
import AlertList from "../components/ui/AlertList";
import EmptyState from "../components/ui/EmptyState";
import MetricCard from "../components/ui/MetricCard";
import RangeTabs from "../components/ui/RangeTabs";
import SectionCard from "../components/ui/SectionCard";
import {
  AlertListSkeleton,
  DevicePanelSkeleton,
  DirectorySkeleton,
  OverviewSkeleton,
  StatusCardListSkeleton,
} from "../components/ui/Skeleton";
import StatusPill from "../components/ui/StatusPill";
import { useAuth } from "../hooks/useAuth";
import { useConfirm } from "../hooks/useConfirm";
import { useSocket } from "../hooks/useSocket";
import { useToast } from "../hooks/useToast";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { FiSmartphone, FiUserX, FiSearch, FiActivity } from "react-icons/fi";

const LOW_SPO2_THRESHOLD = 90;
const LOW_BPM_THRESHOLD = 50;
const HIGH_BPM_THRESHOLD = 120;
const DOCTOR_PAGE_LIMIT = 12;
const VitalChart = lazy(() => import("../components/charts/VitalChart"));

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  window.URL.revokeObjectURL(url);
};

const getReadingStatus = (reading) => {
  if (!reading) {
    return "warning";
  }

  if (
    reading.spo2 < LOW_SPO2_THRESHOLD ||
    reading.bpm < LOW_BPM_THRESHOLD ||
    reading.bpm > HIGH_BPM_THRESHOLD
  ) {
    return "critical";
  }

  return "normal";
};

const getSpo2Trend = (series = []) => {
  if (!Array.isArray(series) || series.length < 2) {
    return "stable";
  }

  const first = Number(series[0]?.spo2);
  const last = Number(series[series.length - 1]?.spo2);

  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return "stable";
  }

  const delta = Number((last - first).toFixed(1));

  if (delta <= -0.5) {
    return "decreasing";
  }

  if (delta >= 0.5) {
    return "increasing";
  }

  return "stable";
};

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const { formatDateTime, t, localeTag } = useUiPreferences();
  const locale = localeTag === "ar-EG" ? "ar" : "en";
  const [range, setRange] = useState("day");
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorPage, setDoctorPage] = useState(1);
  const [doctorTotal, setDoctorTotal] = useState(0);
  const [doctorHasNextPage, setDoctorHasNextPage] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [deviceForm, setDeviceForm] = useState({
    deviceSecretId: "",
    label: "",
  });
  const [loading, setLoading] = useState(true);
  const [deviceSubmitting, setDeviceSubmitting] = useState(false);
  const [assigningDoctorId, setAssigningDoctorId] = useState("");
  const [unassigningAssignmentId, setUnassigningAssignmentId] = useState("");
  const [downloadingFormat, setDownloadingFormat] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantReport, setAssistantReport] = useState(null);
  const [assistantError, setAssistantError] = useState("");
  const [error, setError] = useState("");
  const doctorRequestIdRef = useRef(0);

  const loadDashboard = async (selectedRange = range) => {
    const [dashboardResponse, alertResponse] = await Promise.all([
      getPatientDashboard(selectedRange),
      getPatientAlerts("all"),
    ]);

    setDashboard(dashboardResponse.data);
    setAlerts(alertResponse.data.alerts);
  };

  const loadDoctorDirectory = async ({
    searchValue = doctorSearch,
    pageValue = 1,
    append = false,
  } = {}) => {
    const normalizedSearch = String(searchValue || "").trim();

    if (!normalizedSearch) {
      doctorRequestIdRef.current += 1;
      setDoctorLoading(false);
      setDoctorError("");
      setDoctors([]);
      setDoctorPage(1);
      setDoctorHasNextPage(false);
      setDoctorTotal(0);
      return;
    }

    const requestId = ++doctorRequestIdRef.current;

    setDoctorLoading(true);
    setDoctorError("");

    try {
      const response = await getDoctors({
        search: normalizedSearch,
        page: pageValue,
        limit: DOCTOR_PAGE_LIMIT,
      });

      if (requestId !== doctorRequestIdRef.current) {
        return;
      }

      const nextDoctors = response.data?.doctors || [];
      const pagination = response.data?.pagination || {};

      setDoctors((currentDoctors) =>
        append ? [...currentDoctors, ...nextDoctors] : nextDoctors
      );
      setDoctorPage(pagination.page || pageValue);
      setDoctorHasNextPage(Boolean(pagination.hasNextPage));
      setDoctorTotal(pagination.total || nextDoctors.length);
    } catch (requestError) {
      if (requestId !== doctorRequestIdRef.current) {
        return;
      }

      setDoctorError(
        requestError.response?.data?.message || t("patient.loadDoctorsDirectoryFailed")
      );

      if (!append) {
        setDoctors([]);
      }

      setDoctorHasNextPage(false);
      setDoctorTotal(0);
    } finally {
      if (requestId === doctorRequestIdRef.current) {
        setDoctorLoading(false);
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    setError("");

    loadDashboard(range)
      .catch((requestError) => {
        setError(requestError.response?.data?.message || t("patient.loadDashboardFailed"));
      })
      .finally(() => setLoading(false));
  }, [range, t]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadDoctorDirectory({
        searchValue: doctorSearch,
        pageValue: 1,
      }).catch(() => {});
    }, 280);

    return () => clearTimeout(timeoutId);
  }, [doctorSearch, t]);

  useEffect(() => {
    if (!socket || !user) {
      return undefined;
    }

    const refreshOnSocket = (payload) => {
      if (payload.patientId?.toString() === user._id?.toString()) {
        loadDashboard(range).catch(() => {});
      }
    };

    socket.on("reading:new", refreshOnSocket);
    socket.on("alert:new", refreshOnSocket);

    return () => {
      socket.off("reading:new", refreshOnSocket);
      socket.off("alert:new", refreshOnSocket);
    };
  }, [socket, user, range]);

  const handleLinkDevice = async (event) => {
    event.preventDefault();
    setDeviceSubmitting(true);
    setError("");

    try {
      await linkDevice(deviceForm);
      addToast({ type: "success", message: t("patient.deviceLinked") });
      await loadDashboard(range);
      setDeviceForm({ deviceSecretId: "", label: "" });
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("patient.linkDeviceFailed"));
    } finally {
      setDeviceSubmitting(false);
    }
  };

  const handleAssignDoctor = async (doctorId) => {
    setAssigningDoctorId(doctorId);
    setError("");

    try {
      await assignDoctor({ doctorId });
      addToast({ type: "success", message: t("patient.requestSent") });
      await Promise.all([
        loadDashboard(range),
        loadDoctorDirectory({
          searchValue: doctorSearch,
          pageValue: doctorPage,
        }),
      ]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("patient.assignDoctorFailed"));
    } finally {
      setAssigningDoctorId("");
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await acknowledgePatientAlert(alertId);
      await loadDashboard(range);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("patient.acknowledgeFailed"));
    }
  };

  const handleUnassignDoctor = async (assignmentId) => {
    const confirmed = await confirm({
      title: t("patient.confirmUnassignPrompt"),
      message: "",
      confirmLabel: t("patient.unassignDoctor"),
      cancelLabel: t("common.dashboard"),
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    setUnassigningAssignmentId(assignmentId);
    setError("");

    try {
      await unassignDoctor(assignmentId);
      addToast({ type: "success", message: t("patient.unassignSuccess") });
      await Promise.all([
        loadDashboard(range),
        loadDoctorDirectory({
          searchValue: doctorSearch,
          pageValue: doctorPage,
        }),
      ]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("patient.unassignDoctorFailed"));
    } finally {
      setUnassigningAssignmentId("");
    }
  };

  const handleLoadMoreDoctors = () => {
    if (doctorLoading || !doctorHasNextPage) {
      return;
    }

    loadDoctorDirectory({
      searchValue: doctorSearch,
      pageValue: doctorPage + 1,
      append: true,
    }).catch(() => {});
  };

  const handleDownloadReport = async (format) => {
    setDownloadingFormat(format);
    setError("");

    try {
      const response = await downloadPatientReport(range, format);
      downloadBlob(response.data, `pulse-oximeter-${range}.${format}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("patient.reportFailed"));
    } finally {
      setDownloadingFormat("");
    }
  };

  const handleGenerateAssistantReport = async () => {
    const latestReading = dashboard?.latestReading;

    if (!latestReading?.spo2 || !latestReading?.bpm) {
      setAssistantError(t("patient.assistantMissingReading"));
      setAssistantReport(null);
      return;
    }

    setAssistantLoading(true);
    setAssistantError("");

    try {
      const response = await generatePatientAssistantReport({
        spo2: Number(latestReading.spo2),
        bpm: Number(latestReading.bpm),
        trend: getSpo2Trend(dashboard?.series),
      });

      setAssistantReport(response.data);
    } catch (requestError) {
      setAssistantError(
        requestError.response?.data?.message || t("patient.assistantFailed")
      );
      setAssistantReport(null);
    } finally {
      setAssistantLoading(false);
    }
  };

  const getAssignmentMeta = (assignment) => {
    if (!assignment) {
      return t("patient.availableDoctorDescription");
    }

    if (assignment.status === "pending") {
      return t("common.requestedAt", {
        date: formatDateTime(assignment.requestedAt),
      });
    }

    if (assignment.status === "active") {
      return t("common.approvedAt", {
        date: formatDateTime(assignment.assignedAt),
      });
    }

    if (assignment.status === "denied") {
      return t("common.deniedAt", {
        date: formatDateTime(assignment.respondedAt),
      });
    }

    return t("common.endedAt", {
      date: formatDateTime(assignment.endedAt),
    });
  };

  const getDoctorButtonLabel = (assignment) => {
    if (!assignment) {
      return t("patient.requestDoctor");
    }

    if (assignment.status === "pending") {
      return t("status.pending");
    }

    if (assignment.status === "active") {
      return t("status.active");
    }

    return t("patient.requestAgain");
  };

  const latestStatus = getReadingStatus(dashboard?.latestReading);
  const activeCareTeam = Array.isArray(dashboard?.careTeam?.active)
    ? dashboard.careTeam.active
    : [];
  const pendingCareTeam = Array.isArray(dashboard?.careTeam?.pending)
    ? dashboard.careTeam.pending
    : [];
  const deniedCareTeam = dashboard?.careTeam?.lastDenied;
  const hasCareTeam =
    activeCareTeam.length > 0 || pendingCareTeam.length > 0 || Boolean(deniedCareTeam);
  const getTeamPreviewLabel = (relations, emptyLabel) => {
    if (!relations.length) {
      return emptyLabel;
    }

    const firstDoctorName = relations[0]?.doctor?.name || t("common.notAvailable");

    if (relations.length === 1) {
      return firstDoctorName;
    }

    return t("patient.multiDoctorPreview", {
      name: firstDoctorName,
      count: relations.length - 1,
    });
  };
  const chartFallback = (
    <div className="chart-wrapper live-chart screen-center" aria-hidden="true">
      <div className="loading-dot" />
    </div>
  );

  return (
    <AppShell
      title={t("patient.dashboardTitle")}
      subtitle={t("patient.dashboardSubtitle")}
      actions={<StatusPill status={dashboard?.openAlertCount ? "critical" : latestStatus} />}
    >
      {error && !loading ? <div className="form-error page-feedback" role="alert">{error}</div> : null}

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <SectionCard
            id="patient-overview"
            title={t("patient.vitalOverview")}
            actions={<RangeTabs value={range} onChange={setRange} />}
            className="spotlight-section"
          >
            {loading ? (
              <OverviewSkeleton
                label={t("patient.vitalsLoading")}
                metricVariants={[
                  "live-spo2-card",
                  "live-bpm-card",
                  "alert-metric-card",
                  "sample-metric-card",
                ]}
                showSnapshots
              />
            ) : error ? (
              <div className="form-error">{error}</div>
            ) : (
              <>
                <div className="snapshot-status-grid">
                  <div className="snapshot-status-card">
                    <span>{t("patient.activeDoctor")}</span>
                    <strong>{getTeamPreviewLabel(activeCareTeam, t("patient.noActiveDoctorTitle"))}</strong>
                    <StatusPill status={activeCareTeam.length ? "active" : "warning"} />
                  </div>
                  <div className="snapshot-status-card">
                    <span>{t("patient.pendingRequest")}</span>
                    <strong>{getTeamPreviewLabel(pendingCareTeam, t("common.notAvailable"))}</strong>
                    <StatusPill status={pendingCareTeam.length ? "pending" : "warning"} />
                  </div>
                  <div className="snapshot-status-card">
                    <span>{t("patient.currentDeviceState")}</span>
                    <strong>{dashboard?.device?.label || t("patient.noDeviceTitle")}</strong>
                    <StatusPill status={dashboard?.device?.isActive ? "normal" : "warning"} />
                  </div>
                </div>

                <div className="metrics-grid">
                  <MetricCard
                    label="SpO₂"
                    value={dashboard?.latestReading?.spo2}
                    unit="%"
                    status={latestStatus}
                    caption={t("patient.latestOxygen")}
                    variant="live-spo2-card"
                  />
                  <MetricCard
                    label="BPM"
                    value={dashboard?.latestReading?.bpm}
                    unit="bpm"
                    status={latestStatus}
                    caption={t("patient.latestHeartRate")}
                    variant="live-bpm-card"
                  />
                  <MetricCard
                    label={t("common.openAlerts")}
                    value={dashboard?.openAlertCount || 0}
                    status={dashboard?.openAlertCount ? "critical" : "normal"}
                    caption={t("patient.openAlertsCaption")}
                    variant="alert-metric-card"
                  />
                  <MetricCard
                    label={t("common.samples")}
                    value={dashboard?.summary?.totalReadings || 0}
                    status="normal"
                    caption={t("patient.rangeSamplesCaption")}
                    variant="sample-metric-card"
                  />
                </div>

                <Suspense fallback={chartFallback}>
                  <VitalChart data={dashboard?.series} />
                </Suspense>
              </>
            )}
          </SectionCard>

          <SectionCard
            id="patient-alerts"
            title={t("patient.alertsTimeline")}
            className="history-section"
          >
            {loading ? (
              <AlertListSkeleton label={t("patient.vitalsLoading")} />
            ) : (
              <AlertList alerts={alerts} onAcknowledge={handleAcknowledge} />
            )}
          </SectionCard>
        </div>

        <aside className="dashboard-sidebar">
          <SectionCard
            id="patient-device"
            title={t("patient.connectedDevice")}
            className="device-glass-section"
          >
            {loading ? (
              <DevicePanelSkeleton label={t("patient.vitalsLoading")} />
            ) : dashboard?.device ? (
              <div className="stack-list device-status-panel">
                <div className="line-item">
                  <span>{t("common.label")}</span>
                  <strong>{dashboard.device.label || t("patient.connectedDevice")}</strong>
                </div>
                <div className="line-item">
                  <span>{t("common.status")}</span>
                  <StatusPill status={dashboard.device.isActive ? "normal" : "warning"} />
                </div>
                <div className="line-item">
                  <span>{t("common.lastSeen")}</span>
                  <strong>{formatDateTime(dashboard.device.lastSeenAt)}</strong>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={FiSmartphone}
                title={t("patient.noDeviceTitle")}
                description={t("patient.noDeviceDescription")}
              />
            )}

            <form className="form-stack" onSubmit={handleLinkDevice}>
              <label>
                {t("common.deviceSecretId")}
                <input
                  type="text"
                  value={deviceForm.deviceSecretId}
                  onChange={(event) =>
                    setDeviceForm((current) => ({
                      ...current,
                      deviceSecretId: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                {t("common.deviceLabel")}
                <input
                  type="text"
                  value={deviceForm.label}
                  onChange={(event) =>
                    setDeviceForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
              </label>

              <button className="primary-button" type="submit" disabled={deviceSubmitting}>
                {deviceSubmitting ? t("common.loading") : t("patient.linkDevice")}
              </button>
            </form>
          </SectionCard>

          <SectionCard
            id="patient-care-team"
            title={t("patient.careTeamStatus")}
            className="care-team-section"
          >
            {loading ? (
              <StatusCardListSkeleton
                label={t("patient.vitalsLoading")}
                className="status-detail-card"
              />
            ) : hasCareTeam ? (
              <div className="care-team-list">
                {activeCareTeam.map((relation) => (
                  <article key={relation.id} className="status-detail-card approved">
                    <div className="status-detail-header">
                      <div>
                        <strong>{relation.doctor?.name}</strong>
                        <span>
                          {relation.doctor?.specialty || t("common.doctor")}
                        </span>
                      </div>
                      <StatusPill status="active" />
                    </div>
                    <small>{t("patient.activeDoctorDescription")}</small>
                    <p>{relation.doctor?.email}</p>
                    <small>
                      {t("common.approvedAt", {
                        date: formatDateTime(relation.assignedAt),
                      })}
                    </small>
                  </article>
                ))}

                {pendingCareTeam.map((relation) => (
                  <article key={relation.id} className="status-detail-card pending">
                    <div className="status-detail-header">
                      <div>
                        <strong>{relation.doctor?.name}</strong>
                        <span>
                          {relation.doctor?.specialty || t("common.doctor")}
                        </span>
                      </div>
                      <StatusPill status="pending" />
                    </div>
                    <small>{t("patient.pendingDoctorDescription")}</small>
                    <p>{relation.doctor?.email}</p>
                    <small>
                      {t("common.requestedAt", {
                        date: formatDateTime(relation.requestedAt),
                      })}
                    </small>
                  </article>
                ))}

                {!pendingCareTeam.length && deniedCareTeam ? (
                  <article className="status-detail-card denied">
                    <div className="status-detail-header">
                      <div>
                        <strong>{deniedCareTeam.doctor?.name}</strong>
                        <span>
                          {deniedCareTeam.doctor?.specialty || t("common.doctor")}
                        </span>
                      </div>
                      <StatusPill status="denied" />
                    </div>
                    <small>{t("patient.deniedDoctorDescription")}</small>
                    <p>{deniedCareTeam.doctor?.email}</p>
                    <small>
                      {t("common.deniedAt", {
                        date: formatDateTime(deniedCareTeam.respondedAt),
                      })}
                    </small>
                  </article>
                ) : null}
              </div>
            ) : (
              <EmptyState
                icon={FiUserX}
                title={t("patient.noActiveDoctorTitle")}
                description={t("patient.noActiveDoctorDescription")}
              />
            )}
          </SectionCard>

          <SectionCard
            id="patient-directory"
            title={t("patient.chooseDoctorTitle")}
            className="directory-section"
          >
            <p className="section-note">{t("patient.requestDescription")}</p>

            <label className="search-label">
              {t("patient.searchDoctorsLabel")}
              <div className="search-input-row">
                <input
                  type="text"
                  value={doctorSearch}
                  placeholder={t("patient.searchDoctorsPlaceholder")}
                  onChange={(event) => setDoctorSearch(event.target.value)}
                />
                {doctorSearch ? (
                  <button
                    className="search-clear-btn"
                    type="button"
                    onClick={() => setDoctorSearch("")}
                  >
                    {t("patient.clearDoctorSearch")}
                  </button>
                ) : null}
              </div>
            </label>

            {doctorError ? <div className="form-error">{doctorError}</div> : null}

            {doctorSearch.trim() ? (
              doctorLoading && !doctors.length ? (
                <DirectorySkeleton label={t("patient.loadingDoctorsDirectory")} count={3} />
              ) : doctors.length ? (
                <>
                  <div className="doctor-directory">
                    {doctors.map((doctor) => {
                      const assignment = doctor.assignment;
                      const isDisabled =
                        assignment?.status === "pending" || assignment?.status === "active";
                      const isSubmitting = assigningDoctorId === doctor._id;

                      return (
                        <article key={doctor._id} className="doctor-option-card">
                          <div className="doctor-option-top">
                            <div>
                              <strong>{doctor.name}</strong>
                              <span>{doctor.specialty || t("common.doctor")}</span>
                            </div>
                            {assignment ? <StatusPill status={assignment.status} /> : null}
                          </div>

                          <small>{doctor.email}</small>
                          <p>{getAssignmentMeta(assignment)}</p>

                          <div className="button-row">
                            <button
                              className="primary-button"
                              type="button"
                              disabled={
                                isDisabled || isSubmitting || Boolean(unassigningAssignmentId)
                              }
                              onClick={() => handleAssignDoctor(doctor._id)}
                            >
                              {isSubmitting
                                ? t("common.loading")
                                : getDoctorButtonLabel(assignment)}
                            </button>

                            {assignment?.status === "active" ||
                            assignment?.status === "pending" ? (
                              <button
                                className="ghost-button danger"
                                type="button"
                                disabled={
                                  isSubmitting || unassigningAssignmentId === assignment.id
                                }
                                onClick={() => handleUnassignDoctor(assignment.id)}
                              >
                                {unassigningAssignmentId === assignment.id
                                  ? t("common.loading")
                                  : assignment.status === "pending"
                                    ? t("patient.cancelDoctorRequest")
                                    : t("patient.unassignDoctor")}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="doctor-directory-footer">
                    <small>
                      {t("patient.doctorResultsCount", {
                        shown: doctors.length,
                        total: doctorTotal,
                      })}
                    </small>

                    {doctorHasNextPage ? (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={doctorLoading}
                        onClick={handleLoadMoreDoctors}
                      >
                        {doctorLoading ? t("common.loading") : t("patient.loadMoreDoctors")}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={FiSearch}
                  title={t("patient.noDoctorsFoundTitle")}
                  description={t("patient.noDoctorsFoundDescription")}
                />
              )
            ) : null}
          </SectionCard>

          <SectionCard
            id="patient-reports"
            title={t("patient.reportExport")}
            className="report-section"
          >
            <p className="section-note">{t("patient.reportDescription")}</p>
            <div className="button-row">
              <button
                className="ghost-button"
                type="button"
                disabled={Boolean(downloadingFormat)}
                onClick={() => handleDownloadReport("csv")}
              >
                {downloadingFormat === "csv" ? t("common.loading") : t("patient.downloadCsv")}
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={Boolean(downloadingFormat)}
                onClick={() => handleDownloadReport("pdf")}
              >
                {downloadingFormat === "pdf" ? t("common.loading") : t("patient.downloadPdf")}
              </button>
            </div>
          </SectionCard>

          <SectionCard
            id="patient-assistant"
            title={t("patient.assistantTitle")}
            className="assistant-section"
          >
            <p className="section-note">{t("patient.assistantDescription")}</p>
            <button
              className="primary-button"
              type="button"
              disabled={assistantLoading || loading}
              onClick={handleGenerateAssistantReport}
            >
              {assistantLoading
                ? t("common.loading")
                : t("patient.generateAssistantReport")}
            </button>

            {assistantError ? <div className="form-error">{assistantError}</div> : null}

            {assistantReport ? (
              <article className="assistant-report">
                <small>
                  {t("patient.reportGeneratedAt", {
                    date: formatDateTime(assistantReport.generatedAt),
                  })}
                </small>
                <p>
                  <strong>{t("patient.assistantConditionLabel")}: </strong>
                  {typeof assistantReport.report?.condition === "string" 
                    ? assistantReport.report?.condition 
                    : assistantReport.report?.condition?.[locale] || assistantReport.report?.condition?.en}
                </p>

                <div>
                  <strong>{t("patient.assistantConcernsLabel")}</strong>
                  <ul>
                    {(
                      (Array.isArray(assistantReport.report?.concerns) ? assistantReport.report?.concerns : assistantReport.report?.concerns?.[locale] || assistantReport.report?.concerns?.en) || []
                    ).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong>{t("patient.assistantAdviceLabel")}</strong>
                  <ul>
                    {(
                      (Array.isArray(assistantReport.report?.advice) ? assistantReport.report?.advice : assistantReport.report?.advice?.[locale] || assistantReport.report?.advice?.en) || []
                    ).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <small>
                  {typeof assistantReport.report?.disclaimer === "string" 
                    ? assistantReport.report?.disclaimer 
                    : assistantReport.report?.disclaimer?.[locale] || assistantReport.report?.disclaimer?.en}
                </small>
                {assistantReport.source === "fallback" ? (
                  <small>{t("patient.assistantFallbackNote")}</small>
                ) : null}
              </article>
            ) : null}
          </SectionCard>
        </aside>
      </div>
    </AppShell>
  );
}
