// src/pages/RegisterPage.tsx
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/http";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "", password: "", fullName: "", phoneNumber: "", age: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      });
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  const field = { display: "block", width: "100%", marginBottom: 8, padding: 8 } as const;

  return (
    <div style={{ maxWidth: 360, margin: "64px auto", fontFamily: "system-ui" }}>
      <h1>Register</h1>
      <form onSubmit={onSubmit}>
        <input type="email" placeholder="Email" value={form.email}
          onChange={(e) => update("email", e.target.value)} required style={field} />
        <input type="password" placeholder="Password (min 8)" value={form.password}
          onChange={(e) => update("password", e.target.value)} required style={field} />
        <input type="text" placeholder="Full name" value={form.fullName}
          onChange={(e) => update("fullName", e.target.value)} required style={field} />
        <input type="tel" placeholder="Phone (+351...)" value={form.phoneNumber}
          onChange={(e) => update("phoneNumber", e.target.value)} required style={field} />
        <input type="number" placeholder="Age" value={form.age}
          onChange={(e) => update("age", e.target.value)} required style={field} />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: "100%", padding: 10 }}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p>Have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}