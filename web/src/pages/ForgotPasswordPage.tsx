import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api/auth";
import { ApiError } from "../api/http";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const responseMsg = await requestPasswordReset(email);
      setMsg(responseMsg);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request password reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <aside className="login-art">
        <div className="login-logo">
          <img src="/assets/TriboLogo_NoBackground.png" alt="Tribo" width="36" height="36" />
          <span>Tribo</span>
        </div>
        <div>
          <h1>Forgot your password?</h1>
        </div>
      </aside>

      <main className="login-form-container">
        <form className="login-form" onSubmit={onSubmit}>
          <h2>Reset Password</h2>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {msg && <div className="alert alert-success">{msg}</div>}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <button type="submit" disabled={busy} className="btn btn-primary btn-block">
            {busy ? "Sending..." : "Send Link"}
          </button>

          <p className="login-footer">
            Remembered it? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
