// src/pages/HomePage.tsx
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Shell } from "../components/Shell";

export function HomePage() {
  const { user } = useAuth();

  return (
    <Shell>
      <div className="page-narrow">
        <div className="topbar">
          <div>
            <h1>Welcome</h1>
            <div className="sub">You're signed in to Tribo</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <h3>Your account</h3>
            {user?.verified === false && <span className="pill warn">Pending verification</span>}
          </div>
          <dl className="detail-meta">
            <dt>User ID</dt>
            <dd><code>{user?.userId}</code></dd>
            <dt>Role</dt>
            <dd>{user?.role}</dd>
          </dl>
        </div>

        <div style={{ marginTop: 20 }}>
          <Link to="/activities" className="btn btn-primary">
            Browse activities →
          </Link>
        </div>
      </div>
    </Shell>
  );
}
