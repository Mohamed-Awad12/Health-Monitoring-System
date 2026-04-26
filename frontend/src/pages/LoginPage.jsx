import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import PreferenceControls from "../components/common/PreferenceControls";
import { useAuth } from "../hooks/useAuth";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { getRoleHomePath } from "../utils/roleRoutes";
import "../styles/auth-neo.css";

export default function LoginPage() {
  const { user, login } = useAuth();
  const { t } = useUiPreferences();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const isVerified = searchParams.get("verified");
  const isResetSuccess = searchParams.get("reset");
  const emailFromQuery = searchParams.get("email")?.trim().toLowerCase() || "";

  const [formState, setFormState] = useState({
    email: emailFromQuery,
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!emailFromQuery) {
      return;
    }

    setFormState((current) => ({
      ...current,
      email: current.email || emailFromQuery,
    }));
  }, [emailFromQuery]);

  if (user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      email: formState.email.trim().toLowerCase(),
      password: formState.password,
    };

    if (!payload.email || !payload.password) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const nextUser = await login(payload);
      const nextPath =
        location.state?.from?.pathname || getRoleHomePath(nextUser.role);

      navigate(nextPath, { replace: true });
    } catch (requestError) {
      const details = requestError.response?.data?.details;
      const message = requestError.response?.data?.message || t("auth.loginFailed");

      if (
        details?.code === "EMAIL_NOT_VERIFIED" ||
        message.toLowerCase().includes("verify your email")
      ) {
        const nextEmail = (details?.email || payload.email).trim().toLowerCase();
        const sentFlag = details?.emailSent ? "&sent=1" : "";
        navigate(
          `/verify-email?source=login&email=${encodeURIComponent(nextEmail)}${sentFlag}`,
          { replace: true }
        );
        return;
      }

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(formState.email.trim() && formState.password);

  return (
    <div className="auth-neo-layout">
      <PreferenceControls floating />
      <div className="auth-neo-card">
        <div className="auth-neo-header">
          <Link to="/" className="auth-neo-brand">
            <span className="auth-neo-mark">P</span>
            <span>Pulse</span>
          </Link>
          <h1>{t("auth.loginHeading")}</h1>
        </div>

        <form onSubmit={handleSubmit}>
          {isVerified === "success" && (
            <div className="auth-neo-success" style={{color: 'var(--accent)', marginBottom: '1rem', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem'}}>
              Email verified successfully. You can now log in.
            </div>
          )}
          {isResetSuccess === 'success' && (
            <div className="auth-neo-success" style={{color: 'var(--accent)', marginBottom: '1rem', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem'}}>
              Password reset successful! You can now log in.
            </div>
          )}
          {error && <div className="auth-neo-error">{error}</div>}
          <div className="auth-neo-form-field">
            <label htmlFor="email">{t("common.email")}</label>
            <input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              value={formState.email}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              required
            />
          </div>
          <div className="auth-neo-form-field">
            <label htmlFor="password">{t("common.password")}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={formState.password}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              required
            />
          </div>
          <button
            type="submit"
            className="auth-neo-submit-button"
            disabled={!canSubmit || submitting}
          >
            {submitting ? t("common.signingIn") : t("common.signIn")}
          </button>
        </form>

        <Link to="/forgot-password" style={{display: "block", textAlign: "right", marginBottom: "1rem"}} className="auth-neo-link">Forgot password?</Link>
          <div className="auth-neo-footer">
          {t("auth.noAccount")}{" "}
          <Link to="/register">{t("common.createAccount")}</Link>
        </div>
      </div>
    </div>
  );
}
