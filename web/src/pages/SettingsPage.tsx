// src/pages/SettingsPage.tsx
// Account settings: change password (requires the current one) and account
// privacy. Room to grow — add more sections here over time.
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { ApiError } from "../api/http";
import { getPasswordPolicy, type PasswordPolicy } from "../api/auth";
import { changePassword, setVisibility, setTheme } from "../api/users";

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth();

  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  useEffect(() => {
    getPasswordPolicy().then(setPolicy).catch(() => setPolicy(null));
  }, []);

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <div className="sub">Manage your account</div>
        </div>
      </div>

      <div className="settings-grid">
        <PasswordSection policy={policy} />
        <AppearanceSection
          theme={profile?.themePreference === "DARK" ? "DARK" : "LIGHT"}
          onChanged={refreshProfile}
        />
        <PrivacySection
          visibility={profile?.profileVisibility === "PRIVATE" ? "PRIVATE" : "PUBLIC"}
          onChanged={refreshProfile}
        />
      </div>
    </Shell>
  );
}

function PasswordSection({ policy }: { policy: PasswordPolicy | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (next !== confirm) return setError("New passwords don't match.");
    const minLen = policy?.minLength ?? 8;
    if (next.length < minLen) return setError(`Password must be at least ${minLen} characters.`);

    setBusy(true);
    try {
      const msg = await changePassword(current, next);
      setOk(msg);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card settings-card">
      <h2><Icon name="settings" size={18} /> Change password</h2>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="cur">Current password</label>
          <input id="cur" type="password" value={current} autoComplete="current-password"
            onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="new">New password</label>
          <input id="new" type="password" value={next} autoComplete="new-password"
            onChange={(e) => setNext(e.target.value)} required />
          {policy && policy.rules.length > 0 && (
            <div className="hint">Must contain: {policy.rules.join(" · ")}</div>
          )}
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input id="confirm" type="password" value={confirm} autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)} required />
        </div>

        {error && <p className="form-error">{error}</p>}
        {ok && <p className="hint" style={{ color: "var(--green-600)" }}>{ok}</p>}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

function PrivacySection({
  visibility, onChanged,
}: {
  visibility: "PUBLIC" | "PRIVATE";
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPrivate = visibility === "PRIVATE";

  async function toggle() {
    setError(null);
    setBusy(true);
    try {
      await setVisibility(isPrivate ? "PUBLIC" : "PRIVATE");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update privacy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card settings-card">
      <h2><Icon name="user" size={18} /> Account privacy</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        When private, other members see “Private user” instead of your name and photo
        in clan rosters and the feed. You and backoffice always see your real identity.
      </p>

      <div className="settings-row">
        <div>
          <strong>{isPrivate ? "Private account" : "Public account"}</strong>
          <div className="sub">
            {isPrivate ? "Your identity is hidden from other members." : "Your name and photo are visible."}
          </div>
        </div>
        <button className={"btn " + (isPrivate ? "btn-secondary" : "btn-primary")} onClick={toggle} disabled={busy}>
          {busy ? <Spinner size={14} /> : isPrivate ? "Make public" : "Make private"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

function AppearanceSection({ theme, onChanged }: { theme: "LIGHT" | "DARK", onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === "DARK";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const newTheme = isDark ? "LIGHT" : "DARK";
      await setTheme(newTheme);
      // Update DOM instantly so the user doesn't wait for the profile refresh
      localStorage.setItem("theme", newTheme);
      if (newTheme === "DARK") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update theme.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card settings-card">
      <h2><Icon name="moon" size={18} /> Appearance</h2>

      <div className="settings-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <strong>{isDark ? "Dark mode" : "Light mode"}</strong>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label className="switch">
            <input type="checkbox" checked={isDark} onChange={toggle} disabled={busy} />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
