import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { resendVerificationOtp, verifyEmailOtp } from "../api/authApi";
import PreferenceControls from "../components/common/PreferenceControls";
import { useAuth } from "../hooks/useAuth";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { getRoleHomePath } from "../utils/roleRoutes";
import "../styles/auth-neo.css";

const getPageDescription = (source) => {
  if (source === "register") {
    return "Your account was created. Enter the 6-digit OTP we sent to your email to verify it.";
  }

  if (source === "login") {
    return "Your email is not verified yet. Enter the 6-digit OTP to continue.";
  }

  return "Enter the 6-digit OTP sent to your email address.";
};

export default function VerifyEmailPage() {
  const { user } = useAuth();
  const { t } = useUiPreferences();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const source = searchParams.get("source") || "";
  const sent = searchParams.get("sent") === "1";
  const [formState, setFormState] = useState({
    email: searchParams.get("email")?.trim().toLowerCase() || "",
    otp: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    sent ? "A 6-digit OTP has been sent to your email." : ""
  );

  if (user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const email = formState.email.trim().toLowerCase();
    const otp = formState.otp.trim();

    if (!email || !otp) {
      setError("Email and OTP are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await verifyEmailOtp({ email, otp });
      navigate(`/login?verified=success&email=${encodeURIComponent(email)}`, {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Failed to verify OTP."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    const email = formState.email.trim().toLowerCase();

    if (!email) {
      setError("Email is required to resend OTP.");
      return;
    }

    setResending(true);
    setError("");
    setMessage("");

    try {
      const { data } = await resendVerificationOtp({ email });
      setMessage(data?.message || "Verification OTP sent.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Failed to resend verification OTP."
      );
    } finally {
      setResending(false);
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
          <h1>Verify your email</h1>
          <p>{getPageDescription(source)}</p>
        </div>

        {message ? <div className="auth-neo-success">{message}</div> : null}
        {error ? <div className="auth-neo-error">{error}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="auth-neo-form-field">
            <label htmlFor="email">{t("common.email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus={!formState.email}
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
            <label htmlFor="otp">OTP</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus={Boolean(formState.email)}
              value={formState.otp}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  otp: event.target.value,
                }))
              }
              placeholder="6-digit OTP"
              required
            />
          </div>

          <div className="auth-otp-actions">
            <button
              type="submit"
              className="auth-neo-submit-button"
              disabled={!formState.email.trim() || !formState.otp.trim() || submitting}
            >
              {submitting ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              type="button"
              className="auth-otp-resend-button"
              onClick={handleResendOtp}
              disabled={resending}
            >
              {resending ? "Resending..." : "Resend OTP"}
            </button>
          </div>
        </form>

        <div className="auth-neo-footer">
          Already verified? <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
