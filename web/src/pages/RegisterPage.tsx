// src/pages/RegisterPage.tsx
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/http";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "", password: "", fullName: "", phoneNumber: "", age: "", role: "END_USER",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side checks mirror the backend; the server is still the source of truth.
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    const ageNum = Number(form.age);
    if (!Number.isInteger(ageNum) || ageNum < 13 || ageNum > 120)
      return setError("Age must be a whole number between 13 and 120.");

    setBusy(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        age: ageNum,
        role: form.role,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
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
          <h1>
            Join the tribe.
            <br />
            Pick your clan.
            <br />
            Start the climb.
          </h1>
          <p>
            Log your runs, show up for clean-up events, and push your clan up the
            rankings. It's better with a team.
          </p>
        </div>

        <div className="login-quote">
          "Verified attendance, not self-reported numbers — that's why the
          leaderboard actually means something."
          <strong>— Tribo community</strong>
        </div>
      </aside>

      <section className="login-form">
        <h2>Create your account</h2>
        <p className="subtitle">It takes less than a minute</p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email}
              onChange={(e) => update("email", e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={form.password}
              onChange={(e) => update("password", e.target.value)} required
              autoComplete="new-password" placeholder="At least 8 characters" />
          </div>
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" type="text" value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)} required autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" type="tel" value={form.phoneNumber}
              onChange={(e) => update("phoneNumber", e.target.value)} required
              placeholder="+351…" autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="age">Age</label>
            <input id="age" type="number" value={form.age}
              onChange={(e) => update("age", e.target.value)} required min={13} max={120} />
          </div>
          <div className="field">
            <label htmlFor="role">Account type</label>
            <select id="role" value={form.role} onChange={(e) => update("role", e.target.value)}>
              <option value="END_USER">Participant (browse &amp; join)</option>
              <option value="ACTIVITY_MANAGER">Activity manager (create activities)</option>
              <option value="PARTNER">Partner (organisation)</option>
            </select>
            {form.role !== "END_USER" && (
              <div className="hint warn">
                Manager / partner accounts need backoffice verification before they can
                create activities.
              </div>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          {success && (
            <p className="hint">
              Account created! Verify your email to confirm your account before logging in.
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="login-footer">
          Have an account? <Link to="/login">Sign in →</Link>
        </p>
      </section>
    </div>
  );
}
