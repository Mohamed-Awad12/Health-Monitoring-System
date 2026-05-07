import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminUser,
  deleteAdminUser,
  getDoctorVerificationDocument,
  sendUserVerificationEmail,
  getAdminUsers,
  reviewDoctorVerification,
  updateAdminUser,
} from "../api/adminApi";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import MetricCard from "../components/ui/MetricCard";
import SectionCard from "../components/ui/SectionCard";
import { AdminUsersSkeleton, OverviewSkeleton } from "../components/ui/Skeleton";
import StatusPill from "../components/ui/StatusPill";
import { useAuth } from "../hooks/useAuth";
import { useConfirm } from "../hooks/useConfirm";
import { useToast } from "../hooks/useToast";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { FiUsers } from "react-icons/fi";

const defaultFormState = {
  name: "",
  email: "",
  password: "",
  phone: "",
  role: "patient",
  specialty: "",
  emailVerified: false,
};

const ADMIN_USERS_LIMIT = 20;

const mapRoleToStatus = (role) => {
  if (role === "admin") {
    return "critical";
  }

  if (role === "doctor") {
    return "active";
  }

  return "normal";
};

const mapDoctorVerificationStatusToPill = (status) => {
  if (status === "approved") {
    return "active";
  }

  if (status === "pending") {
    return "warning";
  }

  if (status === "rejected") {
    return "critical";
  }

  return "pending";
};

export default function AdminDashboardPage() {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const { formatDateTime, formatNumber, t } = useUiPreferences();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [doctorVerificationFilter, setDoctorVerificationFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [openingDocumentId, setOpeningDocumentId] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [formState, setFormState] = useState(defaultFormState);
  const [error, setError] = useState("");

  const loadUsers = useCallback(
    async (
      searchValue = search,
      nextRoleFilter = roleFilter,
      nextDoctorVerificationFilter = doctorVerificationFilter,
      cursor = null,
      append = false
    ) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const response = await getAdminUsers({
          search: searchValue.trim() || undefined,
          role: nextRoleFilter,
          doctorVerificationStatus: nextDoctorVerificationFilter,
          cursor: cursor || undefined,
          limit: ADMIN_USERS_LIMIT,
        });

        const nextUsers = response.data?.users || [];

        setUsers((currentUsers) =>
          append ? [...currentUsers, ...nextUsers] : nextUsers
        );
        setTotalUsers(response.data?.pagination?.total ?? nextUsers.length);
        setNextCursor(
          response.data?.nextCursor || response.data?.pagination?.nextCursor || null
        );
      } catch (requestError) {
        setError(requestError.response?.data?.message || t("admin.loadFailed"));
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [doctorVerificationFilter, roleFilter, search, t]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadUsers(search, roleFilter, doctorVerificationFilter).catch(() => {});
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [doctorVerificationFilter, loadUsers, roleFilter, search]);

  const resetForm = () => {
    setEditingUser(null);
    setFormState(defaultFormState);
  };

  const handleEditUser = (nextUser) => {
    setEditingUser(nextUser);
    setFormState({
      name: nextUser.name || "",
      email: nextUser.email || "",
      password: "",
      phone: nextUser.phone || "",
      role: nextUser.role || "patient",
      specialty: nextUser.specialty || "",
      emailVerified: Boolean(nextUser.emailVerified),
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = formState.name.trim();
    const trimmedEmail = formState.email.trim().toLowerCase();
    const trimmedPhone = formState.phone.trim();
    const trimmedSpecialty = formState.specialty.trim();

    if (!trimmedName || !trimmedEmail) {
      return;
    }

    if (!editingUser && !formState.password) {
      setError(t("admin.passwordRequired"));
      return;
    }

    if (formState.role === "doctor" && !trimmedSpecialty) {
      setError(t("admin.specialtyRequired"));
      return;
    }

    setSubmitting(true);
    setError("");

    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      role: formState.role,
      phone: trimmedPhone,
      specialty: formState.role === "doctor" ? trimmedSpecialty : "",
      emailVerified: Boolean(formState.emailVerified),
    };

    if (formState.password) {
      payload.password = formState.password;
    }

    try {
      if (editingUser) {
        await updateAdminUser(editingUser._id, payload);
        addToast({ type: "success", message: t("admin.updateSuccess") });
      } else {
        await createAdminUser(payload);
        addToast({ type: "success", message: t("admin.createSuccess") });
      }

      resetForm();
      await loadUsers(search, roleFilter, doctorVerificationFilter);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (editingUser ? t("admin.updateFailed") : t("admin.createFailed"))
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (nextUser) => {
    const confirmed = await confirm({
      title: t("admin.deleteConfirm", { email: nextUser.email }),
      confirmLabel: t("admin.delete"),
      cancelLabel: t("admin.cancelEdit"),
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    setDeletingId(nextUser._id);
    setError("");

    try {
      await deleteAdminUser(nextUser._id);

      if (editingUser?._id === nextUser._id) {
        resetForm();
      }

      addToast({ type: "success", message: t("admin.deleteSuccess") });
      await loadUsers(search, roleFilter, doctorVerificationFilter);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("admin.deleteFailed"));
    } finally {
      setDeletingId("");
    }
  };

  const handleReviewDoctorVerification = async (nextUser, status) => {
    setReviewingId(nextUser._id);
    setError("");

    try {
      await reviewDoctorVerification(nextUser._id, { status });
      const reviewMsg = status === "approved"
        ? t("admin.doctorVerificationApproved")
        : t("admin.doctorVerificationRejected");
      addToast({ type: "success", message: reviewMsg });
      await loadUsers(search, roleFilter, doctorVerificationFilter);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          t("admin.doctorVerificationActionFailed")
      );
    } finally {
      setReviewingId("");
    }
  };

  const handleOpenVerificationDocument = async (nextUser) => {
    setOpeningDocumentId(nextUser._id);
    setError("");

    try {
      const response = await getDoctorVerificationDocument(nextUser._id);
      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 10000);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          t("admin.doctorVerificationDocumentLoadFailed")
      );
    } finally {
      setOpeningDocumentId("");
    }
  };

  const [sendingEmailId, setSendingEmailId] = useState(null);

  const handleSendVerificationEmail = async (nextUser) => {
    const confirmed = await confirm({
      title: "Send a verification email to " + nextUser.email + "?",
      confirmLabel: "Send Email",
      variant: "primary",
    });

    if (!confirmed) {
      return;
    }

    setSendingEmailId(nextUser._id);
    setError("");

    try {
      await sendUserVerificationEmail(nextUser._id);
      addToast({ type: "success", message: "Verification email sent to " + nextUser.email });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Failed to send verification email."
      );
    } finally {
      setSendingEmailId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setDoctorVerificationFilter("all");
  };

  const handleLoadMoreUsers = () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    loadUsers(
      search,
      roleFilter,
      doctorVerificationFilter,
      nextCursor,
      true
    ).catch(() => {});
  };

  const counts = useMemo(() => {
    return {
      admins: users.filter((nextUser) => nextUser.role === "admin").length,
      doctors: users.filter((nextUser) => nextUser.role === "doctor").length,
      patients: users.filter((nextUser) => nextUser.role === "patient").length,
    };
  }, [users]);

  return (
    <AppShell
      title={t("admin.dashboardTitle")}
      subtitle={t("admin.dashboardSubtitle")}
      actions={
        <>
          <div className="profile-alert">
            <strong>{formatNumber(totalUsers)}</strong>
            <span>{t("admin.usersManaged")}</span>
          </div>
          <div className="profile-alert">
            <strong>{formatNumber(counts.admins)}</strong>
            <span>{t("admin.adminCount")}</span>
          </div>
        </>
      }
    >
      {error ? <div className="form-error page-feedback" role="alert">{error}</div> : null}

      <div className="admin-layout">
        <aside className="admin-side">
          <SectionCard
            id="admin-user-form"
            title={editingUser ? t("admin.userFormEditTitle") : t("admin.userFormCreateTitle")}
            className="directory-section"
          >
            <form className="admin-user-form" onSubmit={handleSubmit}>
              <div className="admin-user-form-grid">
                <label>
                  {t("admin.nameLabel")}
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  {t("admin.emailLabel")}
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  {t("admin.roleLabel")}
                  <select
                    value={formState.role}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        role: event.target.value,
                        specialty:
                          event.target.value === "doctor" ? current.specialty : "",
                      }))
                    }
                  >
                    <option value="patient">{t("role.patient")}</option>
                    <option value="doctor">{t("role.doctor")}</option>
                    <option value="admin">{t("role.admin")}</option>
                  </select>
                </label>

                <label>
                  {t("admin.phoneLabel")}
                  <input
                    type="text"
                    inputMode="tel"
                    value={formState.phone}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>

                {formState.role === "doctor" ? (
                  <label>
                    {t("admin.specialtyLabel")}
                    <input
                      type="text"
                      value={formState.specialty}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          specialty: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                ) : null}

                <label>
                  {t("admin.passwordLabel")}
                  <input
                    type="password"
                    value={formState.password}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder={
                      editingUser ? t("admin.passwordUpdateHint") : t("admin.passwordCreateHint")
                    }
                    required={!editingUser}
                  />
                </label>
              </div>

              <label className="admin-checkbox-line">
                <input
                  type="checkbox"
                  checked={formState.emailVerified}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      emailVerified: event.target.checked,
                    }))
                  }
                />
                <span>{t("admin.emailVerified")}</span>
              </label>

              <div className="button-row">
                <button className="primary-button" type="submit" disabled={submitting}>
                  {submitting
                    ? t("common.loading")
                    : editingUser
                      ? t("admin.updateUser")
                      : t("admin.createUser")}
                </button>

                {editingUser ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    {t("admin.cancelEdit")}
                  </button>
                ) : null}
              </div>
            </form>
          </SectionCard>

          <SectionCard
            id="admin-filters"
            title={t("admin.filtersTitle")}
            className="requests-section"
          >
            <div className="admin-filter-grid">
              <label>
                {t("admin.searchUsers")}
                <input
                  type="text"
                  placeholder={t("admin.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <label>
                {t("admin.roleFilter")}
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                >
                  <option value="all">{t("admin.allRoles")}</option>
                  <option value="patient">{t("role.patient")}</option>
                  <option value="doctor">{t("role.doctor")}</option>
                  <option value="admin">{t("role.admin")}</option>
                </select>
              </label>

              <label>
                {t("admin.doctorVerificationFilter")}
                <select
                  value={doctorVerificationFilter}
                  onChange={(event) => setDoctorVerificationFilter(event.target.value)}
                >
                  <option value="all">{t("admin.doctorVerificationFilterAll")}</option>
                  <option value="pending">{t("admin.doctorVerificationPending")}</option>
                  <option value="approved">{t("admin.doctorVerificationApprovedShort")}</option>
                  <option value="rejected">{t("admin.doctorVerificationRejectedShort")}</option>
                  <option value="not_submitted">
                    {t("admin.doctorVerificationMissing")}
                  </option>
                </select>
              </label>
            </div>

            <div className="button-row">
              <button className="ghost-button" type="button" onClick={clearFilters}>
                {t("admin.clearFilters")}
              </button>
            </div>
          </SectionCard>
        </aside>

        <div className="admin-main">
          <SectionCard
            id="admin-overview"
            title={t("admin.overviewTitle")}
            className="spotlight-section"
          >
            {loading ? (
              <OverviewSkeleton
                label={t("common.loading")}
                metricVariants={[
                  "sample-metric-card",
                  "alert-metric-card",
                  "live-bpm-card",
                  "live-spo2-card",
                ]}
                showChart={false}
              />
            ) : (
              <div className="metrics-grid">
                <MetricCard
                  label={t("admin.totalUsers")}
                  value={totalUsers}
                  status="normal"
                  statusLabel={t("admin.overviewUsersStatus")}
                  caption={t("admin.totalUsersCaption")}
                  variant="sample-metric-card"
                />
                <MetricCard
                  label={t("admin.totalAdmins")}
                  value={counts.admins}
                  status="critical"
                  statusLabel={t("admin.overviewAdminsStatus")}
                  caption={t("admin.totalAdminsCaption")}
                  variant="alert-metric-card"
                />
                <MetricCard
                  label={t("admin.totalDoctors")}
                  value={counts.doctors}
                  status="active"
                  statusLabel={t("admin.overviewDoctorsStatus")}
                  caption={t("admin.totalDoctorsCaption")}
                  variant="live-bpm-card"
                />
                <MetricCard
                  label={t("admin.totalPatients")}
                  value={counts.patients}
                  status="normal"
                  statusLabel={t("admin.overviewPatientsStatus")}
                  caption={t("admin.totalPatientsCaption")}
                  variant="live-spo2-card"
                />
              </div>
            )}
          </SectionCard>

          <SectionCard
            id="admin-users"
            title={t("admin.usersListTitle")}
            className="history-section"
          >
            {loading ? (
              <AdminUsersSkeleton label={t("common.loading")} />
            ) : !users.length ? (
              <EmptyState
                icon={FiUsers}
                title={t("admin.noUsersTitle")}
                description={t("admin.noUsersDescription")}
              />
            ) : (
              <>
                <div className="admin-users-list">
                  {users.map((nextUser) => {
                    const isSelf = currentUser?._id === nextUser._id;

                    return (
                      <article key={nextUser._id} className="admin-user-card">
                      <div className="admin-user-card-head">
                        <div>
                          <strong>{nextUser.name}</strong>
                          <span>{nextUser.email}</span>
                        </div>
                        <StatusPill
                          status={mapRoleToStatus(nextUser.role)}
                          label={t(`role.${nextUser.role}`)}
                        />
                      </div>

                      <div className="admin-user-meta">
                        <small>
                          {t("admin.emailVerified")}: {" "}
                          {nextUser.emailVerified
                            ? t("admin.emailVerifiedYes")
                            : t("admin.emailVerifiedNo")}
                        </small>
                        <small>
                          {t("admin.phoneLabel")}: {nextUser.phone || t("common.notAvailable")}
                        </small>
                        {nextUser.role === "doctor" ? (
                          <>
                            <small>
                              {t("admin.specialtyLabel")}: {" "}
                              {nextUser.specialty || t("common.notAvailable")}
                            </small>
                            <small>
                              {t("admin.doctorVerificationStatus")}: {" "}
                              <StatusPill
                                status={mapDoctorVerificationStatusToPill(
                                  nextUser.doctorVerification?.status
                                )}
                                label={t(
                                  `admin.doctorVerificationStatus_${
                                    nextUser.doctorVerification?.status || "not_submitted"
                                  }`
                                )}
                              />
                            </small>
                          </>
                        ) : null}
                        <small>
                          {t("admin.createdAt", {
                            date: formatDateTime(nextUser.createdAt),
                          })}
                        </small>
                        <small>
                          {t("admin.updatedAt", {
                            date: formatDateTime(nextUser.updatedAt),
                          })}
                        </small>
                      </div>

                      <div className="button-row admin-user-actions">
                        {!nextUser.emailVerified && (
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => handleSendVerificationEmail(nextUser)}
                            disabled={sendingEmailId === nextUser._id}
                          >
                            {sendingEmailId === nextUser._id
                              ? "Sending..."
                              : "Send Verification Email"}
                          </button>
                        )}
                        {nextUser.role === "doctor" &&
                        nextUser.doctorVerification?.documentFileName ? (
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => handleOpenVerificationDocument(nextUser)}
                            disabled={openingDocumentId === nextUser._id}
                          >
                            {openingDocumentId === nextUser._id
                              ? t("common.loading")
                              : t("admin.viewDoctorDocument")}
                          </button>
                        ) : null}
                        {nextUser.role === "doctor" &&
                        nextUser.doctorVerification?.status === "pending" ? (
                          <>
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() =>
                                handleReviewDoctorVerification(nextUser, "approved")
                              }
                              disabled={reviewingId === nextUser._id}
                            >
                              {reviewingId === nextUser._id
                                ? t("common.loading")
                                : t("admin.approveDoctorVerification")}
                            </button>
                            <button
                              className="ghost-button danger"
                              type="button"
                              onClick={() =>
                                handleReviewDoctorVerification(nextUser, "rejected")
                              }
                              disabled={reviewingId === nextUser._id}
                            >
                              {reviewingId === nextUser._id
                                ? t("common.loading")
                                : t("admin.rejectDoctorVerification")}
                            </button>
                          </>
                        ) : null}
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => handleEditUser(nextUser)}
                          disabled={submitting || deletingId === nextUser._id}
                        >
                          {t("admin.edit")}
                        </button>
                        <button
                          className="ghost-button danger"
                          type="button"
                          onClick={() => handleDeleteUser(nextUser)}
                          disabled={
                            submitting || deletingId === nextUser._id || isSelf
                          }
                          title={isSelf ? t("admin.cannotDeleteSelf") : undefined}
                        >
                          {deletingId === nextUser._id
                            ? t("common.loading")
                            : t("admin.delete")}
                        </button>
                      </div>
                      </article>
                    );
                  })}
                </div>

                {nextCursor ? (
                  <div className="admin-users-footer">
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={loadingMore}
                      onClick={handleLoadMoreUsers}
                    >
                      {loadingMore ? t("common.loading") : t("admin.loadMoreUsers")}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
