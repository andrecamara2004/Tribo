import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth";
import { ApiError } from "../api/http";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const responseMsg = await resetPassword(token, newPassword);
      setMsg(responseMsg);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="login">
        <main className="login-form-container">
          <div className="alert alert-error">Invalid or missing reset token.</div>
          <Link to="/login" className="btn btn-primary btn-block">Go to Sign in</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="login">
      <aside className="login-art">
        <div className="login-logo">
          <img src="/assets/TriboLogo_NoBackground.png" alt="Tribo" width="36" height="36" />
          <span>Tribo</span>
        </div>
        <div>
          <h1>Create new password</h1>
        </div>
      </aside>

      <main className="login-form-container">
        <form className="login-form" onSubmit={onSubmit}>
          <h2>Reset Password</h2>

          {error && <div className="alert alert-error">{error}</div>}
          {msg && (
            <div className="alert alert-success">
              {msg} <Link to="/login" style={{ color: "inherit", textDecoration: "underline" }}>Sign in now.</Link>
            </div>
          )}

          {!msg && (
            <>
              <div className="field">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="field">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                />
              </div>

              <button type="submit" disabled={busy} className="btn btn-primary btn-block">
                {busy ? "Resetting..." : "Reset Password"}
              </button>
            </>
          )}

        </form>
      </main>
    </div>
  );
}
