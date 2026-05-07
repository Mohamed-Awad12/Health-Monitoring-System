import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import CaptchaField, { captchaIsRequired } from "../components/common/CaptchaField";
import PreferenceControls from "../components/common/PreferenceControls";
import { useAuth } from "../hooks/useAuth";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { getRoleHomePath } from "../utils/roleRoutes";
import "../styles/auth-neo.css";

export default function VerifyTwoFactorPage() {
  const { user, verifyTwoFactor } = useAuth();
  const { t } = useUiPreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const [tempToken, setTempToken] = useState(
    () =>
      location.state?.tempToken ||
      window.sessionStorage.getItem("pulse_2fa_temp_token") ||
      ""
  );
  const [email, setEmail] = useState(
    () => location.state?.email || window.sessionStorage.getItem("pulse_2fa_email") || ""
  );
  const [otp, setOtp] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (location.state?.tempToken) {
      window.sessionStorage.setItem("pulse_2fa_temp_token", location.state.tempToken);
      setTempToken(location.state.tempToken);
    }

    if (location.state?.email) {
      window.sessionStorage.setItem("pulse_2fa_email", location.state.email);
      setEmail(location.state.email);
    }
  }, [location.state]);

  if (user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!tempToken || !otp.trim()) {
      setError(t("auth.twoFactorMissingCode"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const nextUser = await verifyTwoFactor({
        tempToken,
        otp: otp.trim(),
        captchaToken,
      });

      window.sessionStorage.removeItem("pulse_2fa_temp_token");
      window.sessionStorage.removeItem("pulse_2fa_email");
      navigate(getRoleHomePath(nextUser.role), { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("auth.twoFactorFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-neo-layout">
      <PreferenceControls floating />
      <div className="auth-neo-card">
        <div className="auth-neo-header">
          <Link to="/" className="auth-neo-brand">
            <span className="auth-neo-mark">P</span>
            <span>Pulse</span>
          </Link>
          <h1>{t("auth.twoFactorTitle")}</h1>
          <p>
            {email
              ? t("auth.twoFactorDescriptionWithEmail", { email })
              : t("auth.twoFactorDescription")}
          </p>
        </div>

        {!tempToken ? (
          <div className="auth-neo-error">{t("auth.twoFactorMissingSession")}</div>
        ) : null}
        {error ? <div className="auth-neo-error">{error}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="auth-neo-form-field">
            <label htmlFor="two-factor-otp">{t("auth.twoFactorOtpLabel")}</label>
            <input
              id="two-factor-otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder={t("auth.twoFactorOtpPlaceholder")}
              required
            />
          </div>

          <CaptchaField onTokenChange={setCaptchaToken} />

          <button
            type="submit"
            className="auth-neo-submit-button"
            disabled={
              !tempToken ||
              !otp.trim() ||
              submitting ||
              (captchaIsRequired() && !captchaToken)
            }
          >
            {submitting ? t("auth.twoFactorVerifying") : t("auth.twoFactorVerify")}
          </button>
        </form>

        <div className="auth-neo-footer">
          <Link to="/login">{t("auth.twoFactorBackToLogin")}</Link>
        </div>
      </div>
    </div>
  );
}
