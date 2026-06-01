// src/pages/LoginPage.tsx
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/http";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/activities", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "64px auto", fontFamily: "system-ui" }}>
      <h1>Log in</h1>
      <form onSubmit={onSubmit}>
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required
          style={{ display: "block", width: "100%", marginBottom: 8, padding: 8 }} />
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required
          style={{ display: "block", width: "100%", marginBottom: 8, padding: 8 }} />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: "100%", padding: 10 }}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p>No account? <Link to="/register">Register</Link></p>
    </div>
  );
}