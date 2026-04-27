import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import PreferenceControls from "../components/common/PreferenceControls";
import { useAuth } from "../hooks/useAuth";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { getRoleHomePath } from "../utils/roleRoutes";
import "../styles/auth-neo.css";

const defaultPatientState = {
  name: "",
  email: "",
  password: "",
  phone: "",
};

const defaultDoctorState = {
  ...defaultPatientState,
  specialty: "",
};

export default function RegisterPage() {
  const { user, register } = useAuth();
  const { t } = useUiPreferences();
  const navigate = useNavigate();
  const [role, setRole] = useState("patient");
  const [formState, setFormState] = useState(defaultPatientState);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationDocument, setVerificationDocument] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setError("");
    setConfirmPassword("");
    setVerificationDocument(null);
    setFormState(
      nextRole === "doctor" ? defaultDoctorState : defaultPatientState
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...formState,
      name: formState.name.trim(),
      email: formState.email.trim(),
      phone: formState.phone.trim(),
      specialty: (formState.specialty || "").trim(),
      verificationDocument,
    };

    if (payload.password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await register(role, payload);
      const emailSent = Boolean(data?.emailVerification?.emailSent);
      const deliveryFlag = emailSent ? "&sent=1" : "&delivery=failed";
      navigate(
        `/verify-email?source=register&email=${encodeURIComponent(payload.email)}${deliveryFlag}`,
        { replace: true }
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || t("auth.registrationFailed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requiredReady =
    Boolean(formState.name.trim()) &&
    Boolean(formState.email.trim()) &&
    Boolean(formState.password) &&
    Boolean(confirmPassword) &&
    (role !== "doctor" ||
      (Boolean((formState.specialty || "").trim()) && Boolean(verificationDocument)));

  const canSubmit = requiredReady && formState.password === confirmPassword;

  return (
    <div className="auth-neo-layout">
      <PreferenceControls floating />
      <div className="auth-neo-card">
        <div className="auth-neo-header">
          <Link to="/" className="auth-neo-brand">
            <span className="auth-neo-mark">P</span>
            <span>Pulse</span>
          </Link>
          <h1>{t("auth.registerHeading")}</h1>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="auth-neo-error">{error}</div>}

          <div
            className="auth-role-toggle"
            role="radiogroup"
            aria-label={t("auth.registerHeading")}
          >
            <button
              type="button"
              className={`auth-role-option ${role === "patient" ? "active" : ""}`}
              aria-pressed={role === "patient"}
              onClick={() => handleRoleChange("patient")}
            >
              <span className="auth-role-option-title">{t("role.patient")}</span>
            </button>
            <button
              type="button"
              className={`auth-role-option ${role === "doctor" ? "active" : ""}`}
              aria-pressed={role === "doctor"}
              onClick={() => handleRoleChange("doctor")}
            >
              <span className="auth-role-option-title">{t("role.doctor")}</span>
            </button>
          </div>

          <div className="auth-neo-form-field">
            <label htmlFor="name">{t("common.fullName")}</label>
            <input
              id="name"
              type="text"
              autoFocus
              autoComplete="name"
              value={formState.name}
              onChange={(e) =>
                setFormState((curr) => ({ ...curr, name: e.target.value }))
              }
              required
            />
          </div>
          <div className="auth-neo-form-field">
            <label htmlFor="email">{t("common.email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={formState.email}
              onChange={(e) =>
                setFormState((curr) => ({ ...curr, email: e.target.value }))
              }
              required
            />
          </div>
          {role === "doctor" && (
            <>
              <div className="auth-neo-form-field">
                <label htmlFor="specialty">{t("common.specialty")}</label>
                <input
                  id="specialty"
                  type="text"
                  autoComplete="organization-title"
                  value={formState.specialty}
                  onChange={(e) =>
                    setFormState((curr) => ({
                      ...curr,
                      specialty: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="auth-neo-form-field">
                <label htmlFor="verificationDocument">
                  {t("auth.doctorVerificationDocument")}
                </label>
                <div
                  className="auth-document-upload"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("drag-active");
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("drag-active");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("drag-active");
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setVerificationDocument(file);
                    }
                  }}
                >
                  <input
                    id="verificationDocument"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(event) =>
                      setVerificationDocument(event.target.files?.[0] || null)
                    }
                    className="auth-document-input"
                    required
                  />
                  <div className="auth-document-prompt">
                    <div className="auth-document-icon">📄</div>
                    <p className="auth-document-main">
                      {verificationDocument
                        ? verificationDocument.name
                        : t("auth.doctorVerificationUploadPrompt")}
                    </p>
                    {verificationDocument && (
                      <p className="auth-document-size">
                        {(verificationDocument.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                    {!verificationDocument && (
                      <p className="auth-document-secondary">
                        {t("auth.doctorVerificationDragHint")}
                      </p>
                    )}
                  </div>
                </div>
                <small className="auth-helper-text">
                  {t("auth.doctorVerificationHint")}
                </small>
              </div>
            </>
          )}
          <div className="auth-neo-form-field">
            <label htmlFor="phone">{t("common.phone")}</label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={formState.phone}
              onChange={(e) =>
                setFormState((curr) => ({ ...curr, phone: e.target.value }))
              }
            />
          </div>
          <div className="auth-neo-form-field">
            <label htmlFor="password">{t("common.password")}</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={formState.password}
              onChange={(e) =>
                setFormState((curr) => ({ ...curr, password: e.target.value }))
              }
              required
            />
          </div>
          <div className="auth-neo-form-field">
            <label htmlFor="confirmPassword">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-neo-submit-button"
            disabled={!canSubmit || submitting}
          >
            {submitting
              ? t("common.creatingAccount")
              : t("common.createAccount")}
          </button>
        </form>

        <div className="auth-neo-footer">
          {t("auth.alreadyRegistered")} {" "}
          <Link to="/login">{t("common.signIn")}</Link>
        </div>
      </div>
    </div>
  );
}
