import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../api/authApi";
import CaptchaField, { captchaIsRequired } from "../components/common/CaptchaField";
import PreferenceControls from "../components/common/PreferenceControls";
import "../styles/auth-neo.css";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await forgotPassword({ email: normalizedEmail, captchaToken });
      navigate(
        `/reset-password?sent=1&email=${encodeURIComponent(normalizedEmail)}`,
        { replace: true }
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send reset OTP");
    } finally {
      setLoading(false);
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
          <h1>Forgot password</h1>
          <p>Enter your email and we will send a 6-digit OTP.</p>
        </div>

        {error && <div className="auth-neo-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-neo-form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <CaptchaField onTokenChange={setCaptchaToken} />

          <button
            type="submit"
            className="auth-neo-submit-button"
            disabled={!email.trim() || loading || (captchaIsRequired() && !captchaToken)}
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>

        <div className="auth-neo-footer">
          Remember your password? <Link to="/login">Log in here</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
