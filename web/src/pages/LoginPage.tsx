// src/pages/LoginPage.tsx
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/http";
import { resendVerification } from "../api/auth";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResendMsg(null);
    setNeedsVerify(false);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/activities", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerify(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "Login failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setResendMsg(null);
    try {
      setResendMsg(await resendVerification(email));
    } catch {
      setResendMsg("Couldn't resend right now — try again in a minute.");
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
          <h1>
            Run together.
            <br />
            Compete together.
            <br />
            Make impact.
          </h1>
          <p>
            Form a clan. Climb the rankings. Clean up your city.
            <br />
            A runner's app for people who don't run alone.
          </p>
        </div>

        <div className="login-quote">
          "We jumped from 4th to 1st in two weeks just because the team knew the
          average pace was on the line."
          <strong>— Forest Runners, currently #1</strong>
        </div>
      </aside>

      <section className="login-form">
        <h2>Welcome back</h2>
        <p className="subtitle">Sign in to your Tribo account</p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          {needsVerify && (
            <div className="hint">
              <button type="button" className="btn btn-secondary btn-block" onClick={onResend}>
                Resend confirmation email
              </button>
              {resendMsg && <p className="hint">{resendMsg}</p>}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary btn-block">
            {busy ? "Signing in..." : "Sign in"}
          </button>

          <p className="login-footer" style={{ marginTop: "1rem", textAlign: "center" }}>
            <Link to="/forgot-password" style={{ fontSize: "0.9rem" }}>Forgot your password?</Link>
          </p>

          <p className="login-footer">
            New to Tribo? <Link to="/register">Create your account</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
