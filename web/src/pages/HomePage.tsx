// src/pages/HomePage.tsx
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div style={{ maxWidth: 480, margin: "64px auto", fontFamily: "system-ui" }}>
      <h1>Welcome</h1>
      <p>You are logged in.</p>
      <p><strong>User ID:</strong> {user?.userId}</p>
      <p><strong>Role:</strong> {user?.role}</p>
      <p><Link to="/activities">Browse activities →</Link></p>
      <button onClick={onLogout} style={{ padding: 10 }}>Log out</button>
    </div>
  );
}