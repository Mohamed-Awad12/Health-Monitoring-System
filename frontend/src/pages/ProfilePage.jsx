import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  changeCurrentUserPassword,
  deleteCurrentUserAccount,
  updateCurrentUserProfile,
  updateCurrentUserTwoFactor,
} from "../api/authApi";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/ui/SectionCard";
import StatusPill from "../components/ui/StatusPill";
import { useAuth } from "../hooks/useAuth";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useToast } from "../hooks/useToast";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { getRoleHomePath } from "../utils/roleRoutes";

const getDoctorVerificationPresentation = (status, t) => {
  if (status === "approved") {
    return {
      status: "active",
      label: t("profile.doctorVerificationApproved"),
    };
  }

  if (status === "rejected") {
    return {
      status: "critical",
      label: t("profile.doctorVerificationRejected"),
    };
  }

  return {
    status: "warning",
    label: t("profile.doctorVerificationPending"),
  };
};

export default function ProfilePage() {
  const { user, logout, updateCurrentUser } = useAuth();
  const pushNotifications = usePushNotifications();
  const { addToast } = useToast();
  const { formatDateTime, t } = useUiPreferences();
  const navigate = useNavigate();
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteForm, setDeleteForm] = useState({
    currentPassword: "",
    confirmation: "",
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [twoFactorSubmitting, setTwoFactorSubmitting] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    });
  }, [user]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      name: profileForm.name.trim(),
      email: profileForm.email.trim().toLowerCase(),
      phone: profileForm.phone.trim(),
    };

    if (!payload.name || !payload.email) {
      setProfileError(t("profile.requiredFields"));
      return;
    }

    setProfileSubmitting(true);
    setProfileError("");

    try {
      const { data } = await updateCurrentUserProfile(payload);

      if (data.sessionRevoked) {
        logout();

        const sentFlag = data.emailVerification?.emailSent ? "&sent=1" : "";
        const deliveryFlag =
          data.emailVerification?.emailSent === false ? "&delivery=failed" : "";

        navigate(
          `/verify-email?source=profile&email=${encodeURIComponent(payload.email)}${sentFlag}${deliveryFlag}`,
          { replace: true }
        );
        return;
      }

      updateCurrentUser(data.user);
      addToast({ type: "success", message: data.message || t("profile.profileUpdated") });
    } catch (requestError) {
      setProfileError(
        requestError.response?.data?.message || t("profile.profileUpdateFailed")
      );
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError(t("profile.passwordFieldsRequired"));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }

    setPasswordSubmitting(true);
    setPasswordError("");

    try {
      const { data } = await changeCurrentUserPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      updateCurrentUser(data.user);
      addToast({ type: "success", message: data.message || t("profile.passwordUpdated") });
    } catch (requestError) {
      setPasswordError(
        requestError.response?.data?.message || t("profile.passwordUpdateFailed")
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDeleteSubmit = async (event) => {
    event.preventDefault();

    if (!deleteForm.currentPassword) {
      setDeleteError(t("profile.deletePasswordRequired"));
      return;
    }

    if (deleteForm.confirmation.trim().toUpperCase() !== "DELETE") {
      setDeleteError(t("profile.deleteConfirmationMismatch"));
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError("");

    try {
      await deleteCurrentUserAccount({
        currentPassword: deleteForm.currentPassword,
        confirmation: deleteForm.confirmation.trim(),
      });

      logout();
      navigate(`/login?deleted=success&role=${encodeURIComponent(user?.role || "")}`, {
        replace: true,
      });
    } catch (requestError) {
      setDeleteError(
        requestError.response?.data?.message || t("profile.deleteFailed")
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handlePushToggle = async () => {
    try {
      if (pushNotifications.isSubscribed) {
        await pushNotifications.unsubscribe();
        addToast({ type: "success", message: t("profile.pushDisabled") });
      } else {
        await pushNotifications.subscribe();
        addToast({ type: "success", message: t("profile.pushEnabled") });
      }
    } catch (requestError) {
      addToast({
        type: "error",
        message:
          requestError.response?.data?.message ||
          (pushNotifications.isSubscribed
            ? t("profile.pushDisableFailed")
            : t("profile.pushEnableFailed")),
      });
    }
  };

  const handleTwoFactorToggle = async () => {
    setTwoFactorSubmitting(true);

    try {
      const enabled = !user?.twoFactorEnabled;
      const { data } = await updateCurrentUserTwoFactor({ enabled });

      updateCurrentUser(data.user);
      addToast({
        type: "success",
        message: enabled ? t("profile.twoFactorEnabled") : t("profile.twoFactorDisabled"),
      });
    } catch (requestError) {
      addToast({
        type: "error",
        message: requestError.response?.data?.message || t("profile.twoFactorUpdateFailed"),
      });
    } finally {
      setTwoFactorSubmitting(false);
    }
  };

  const emailVerificationStatus = user?.emailVerified
    ? {
        status: "active",
        label: t("profile.verified"),
      }
    : {
        status: "warning",
        label: t("profile.notVerified"),
      };

  const doctorVerificationStatus =
    user?.role === "doctor"
      ? getDoctorVerificationPresentation(user.doctorVerification?.status, t)
      : null;
  const supportsTwoFactor = ["doctor", "admin"].includes(user?.role);

  return (
    <AppShell title={t("profile.title")} subtitle={t("profile.subtitle")}>
      <div className="profile-page-grid">
        <SectionCard title={t("profile.accountInformation")}>
          {profileError ? <div className="form-error page-feedback" role="alert">{profileError}</div> : null}

          <form className="profile-form" onSubmit={handleProfileSubmit}>
            <div className="profile-form-grid">
              <label>
                {t("common.fullName")}
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                {t("common.email")}
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                {t("common.phone")}
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                {t("profile.accountRole")}
                <input type="text" value={t(`role.${user?.role}`)} readOnly />
              </label>
            </div>

            <div className="button-row">
              <button
                className="primary-button"
                type="submit"
                disabled={profileSubmitting}
              >
                {profileSubmitting ? t("profile.saving") : t("profile.saveChanges")}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title={t("profile.accountStatus")}>
          <div className="profile-status-list">
            <div className="profile-status-item">
              <div>
                <strong>{t("profile.emailVerification")}</strong>
                <span>{t("profile.emailVerificationHint")}</span>
              </div>
              <StatusPill
                status={emailVerificationStatus.status}
                label={emailVerificationStatus.label}
              />
            </div>

            {doctorVerificationStatus ? (
              <div className="profile-status-item">
                <div>
                  <strong>{t("profile.doctorVerification")}</strong>
                  <span>{t("profile.doctorVerificationHint")}</span>
                </div>
                <StatusPill
                  status={doctorVerificationStatus.status}
                  label={doctorVerificationStatus.label}
                />
              </div>
            ) : null}

            <div className="profile-status-item">
              <div>
                <strong>{t("profile.memberSince")}</strong>
                <span>{t("profile.memberSinceHint")}</span>
              </div>
              <span className="profile-status-meta">{formatDateTime(user?.createdAt)}</span>
            </div>

            <div className="profile-status-item">
              <div>
                <strong>{t("profile.lastUpdated")}</strong>
                <span>{t("profile.lastUpdatedHint")}</span>
              </div>
              <span className="profile-status-meta">{formatDateTime(user?.updatedAt)}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t("profile.preferences")}>
          <div className="profile-status-list">
            {supportsTwoFactor ? (
              <div className="profile-status-item">
                <div>
                  <strong>{t("profile.twoFactorAuthentication")}</strong>
                  <span>{t("profile.twoFactorHint")}</span>
                </div>
                <StatusPill
                  status={user?.twoFactorEnabled ? "active" : "warning"}
                  label={
                    user?.twoFactorEnabled
                      ? t("profile.twoFactorOn")
                      : t("profile.twoFactorOff")
                  }
                />
              </div>
            ) : null}

            <div className="profile-status-item">
              <div>
                <strong>{t("profile.pushNotifications")}</strong>
                <span>
                  {pushNotifications.isSupported
                    ? t("profile.pushNotificationsHint")
                    : t("profile.pushUnsupported")}
                </span>
              </div>
              <StatusPill
                status={pushNotifications.isSubscribed ? "active" : "warning"}
                label={
                  pushNotifications.isSubscribed
                    ? t("profile.pushSubscribed")
                    : t("profile.pushNotSubscribed")
                }
              />
            </div>
          </div>
          <div className="button-row">
            {supportsTwoFactor ? (
              <button
                className="primary-button"
                type="button"
                disabled={twoFactorSubmitting}
                onClick={handleTwoFactorToggle}
              >
                {twoFactorSubmitting
                  ? t("common.loading")
                  : user?.twoFactorEnabled
                    ? t("profile.disableTwoFactor")
                    : t("profile.enableTwoFactor")}
              </button>
            ) : null}
            <button
              className="primary-button"
              type="button"
              disabled={!pushNotifications.isSupported || pushNotifications.loading}
              onClick={handlePushToggle}
            >
              {pushNotifications.loading
                ? t("common.loading")
                : pushNotifications.isSubscribed
                  ? t("profile.disablePush")
                  : t("profile.enablePush")}
            </button>
          </div>
        </SectionCard>

        <SectionCard title={t("profile.changePassword")}>
          {passwordError ? <div className="form-error page-feedback" role="alert">{passwordError}</div> : null}

          <form className="profile-form" onSubmit={handlePasswordSubmit}>
            <div className="profile-form-grid">
              <label>
                {t("profile.currentPassword")}
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                {t("profile.newPassword")}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="profile-form-span-full">
                {t("profile.confirmNewPassword")}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            <div className="button-row">
              <button
                className="primary-button"
                type="submit"
                disabled={passwordSubmitting}
              >
                {passwordSubmitting ? t("profile.updatingPassword") : t("profile.updatePassword")}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title={t("profile.dangerZone")} className="danger-zone-section">
          {deleteError ? <div className="form-error page-feedback">{deleteError}</div> : null}

          <div className="danger-zone-copy">
            <p>{t("profile.deleteDescription")}</p>
            <p>{t("profile.deleteHint")}</p>
            {user?.role === "admin" ? <p>{t("profile.adminDeleteHint")}</p> : null}
          </div>

          <form className="profile-form" onSubmit={handleDeleteSubmit}>
            <div className="profile-form-grid">
              <label>
                {t("profile.currentPassword")}
                <input
                  type="password"
                  autoComplete="current-password"
                  value={deleteForm.currentPassword}
                  onChange={(event) =>
                    setDeleteForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                {t("profile.typeDelete")}
                <input
                  type="text"
                  value={deleteForm.confirmation}
                  onChange={(event) =>
                    setDeleteForm((current) => ({
                      ...current,
                      confirmation: event.target.value,
                    }))
                  }
                  placeholder="DELETE"
                  required
                />
              </label>
            </div>

            <div className="button-row">
              <button
                className="ghost-button danger"
                type="submit"
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? t("profile.deleting") : t("profile.deleteAccount")}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => navigate(getRoleHomePath(user?.role))}
              >
                {t("common.dashboard")}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  );
}
