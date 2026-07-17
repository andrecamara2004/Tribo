// src/pages/VerifyEmailPage.tsx
// Landing page for the confirmation link emailed at registration. Reads ?token,
// confirms it against the API, and points the user to sign in.
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api/auth";
import { ApiError } from "../api/http";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  // Initial state is derived (no synchronous setState in the effect).
  const [status, setStatus] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [message, setMessage] = useState(
    token ? "Confirming your email…" : "This link is missing its token.",
  );
  const ran = useRef(false); // guard against React 18 StrictMode double-invoke

  useEffect(() => {
    if (ran.current || !token) return;
    ran.current = true;

    verifyEmail(token)
      .then((msg) => {
        setStatus("ok");
        setMessage(msg);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Could not confirm this email.");
      });
  }, [token]);

  return (
    <div className="login">
      <section className="login-form" style={{ margin: "auto", textAlign: "center" }}>
        <div className="login-logo" style={{ justifyContent: "center", marginBottom: 20 }}>
          <img src="/assets/TriboLogo_NoBackground.png" alt="Tribo" width="36" height="36" />
          <span>Tribo</span>
        </div>

        <h2>
          {status === "ok" ? "Email confirmed ✅" : status === "error" ? "Confirmation failed" : "Confirming…"}
        </h2>
        <p className="subtitle">{message}</p>

        {status === "ok" && (
          <Link to="/login" className="btn btn-primary btn-block">
            Go to sign in →
          </Link>
        )}
        {status === "error" && (
          <p className="login-footer">
            Need a new link? <Link to="/login">Sign in</Link> and resend it.
          </p>
        )}
      </section>
    </div>
  );
}
