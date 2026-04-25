import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { forgotPassword, resetPassword } from "../api/authApi";
import PreferenceControls from "../components/common/PreferenceControls";
import "../styles/auth-neo.css";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const isTokenFlow = Boolean(token);
  const [email, setEmail] = useState(
    searchParams.get("email")?.trim().toLowerCase() || ""
  );
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(
    searchParams.get("sent") === "1"
      ? "A 6-digit OTP has been sent to your email."
      : ""
  );
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!password || (!isTokenFlow && (!normalizedEmail || !normalizedOtp))) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isTokenFlow) {
        await resetPassword(token, password);
      } else {
        await resetPassword({
          email: normalizedEmail,
          otp: normalizedOtp,
          password,
        });
      }

      navigate("/login?reset=success", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Email is required to resend the OTP.");
      return;
    }

    setResending(true);
    setError(null);
    setMessage("");

    try {
      const { data } = await forgotPassword(normalizedEmail);
      setMessage(data?.message || "A new OTP has been sent to your email.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  const canSubmit = isTokenFlow
    ? Boolean(password && confirmPassword)
    : Boolean(email.trim() && otp.trim() && password && confirmPassword);

  return (
    <div className="auth-neo-layout">
      <PreferenceControls floating />
      <div className="auth-neo-card">
        <div className="auth-neo-header">
          <Link to="/" className="auth-neo-brand">
            <span className="auth-neo-mark">P</span>
            <span>Pulse</span>
          </Link>
          <h1>Reset password</h1>
          <p>
            {isTokenFlow
              ? "Choose a new password for your account."
              : "Enter the OTP from your email, then choose a new password."}
          </p>
        </div>

        {message ? <div className="auth-neo-success">{message}</div> : null}
        {error && <div className="auth-neo-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isTokenFlow ? (
            <>
              <div className="auth-neo-form-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit OTP"
                  required
                />
              </div>
            </>
          ) : null}

          <div className="auth-neo-form-field">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="auth-neo-form-field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {isTokenFlow ? (
            <button
              type="submit"
              className="auth-neo-submit-button"
              disabled={!canSubmit || loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          ) : (
            <div className="auth-otp-actions">
              <button
                type="submit"
                className="auth-neo-submit-button"
                disabled={!canSubmit || loading}
              >
                {loading ? "Resetting..." : "Reset Password"}
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
          )}
        </form>

        <div className="auth-neo-footer">
          Remember your password? <Link to="/login">Log in here</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
