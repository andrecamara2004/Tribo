// src/components/Shell.tsx
// Authenticated app shell: sidebar + main content, ported from the prototype.
// Only the screens the backend can populate today are live; the remaining
// prototype destinations are shown but disabled ("soon") so the navigation
// stays visually complete without dead links.
import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path?: string; // present → live route; absent → not built yet
}

const NAV: NavItem[] = [
  { id: "feed", label: "Feed", icon: "home", path: "/feed" },
  { id: "track", label: "Last run", icon: "run", path: "/track" },
  { id: "ranking", label: "Clan ranking", icon: "trophy", path: "/ranking" },
  { id: "activities", label: "Volunteer", icon: "leaf", path: "/activities" },
  { id: "profile", label: "Profile", icon: "user", path: "/profile" },
];

/** ACTIVITY_MANAGER → "Activity Manager" */
function humanizeRole(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function onSignOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  const roleLabel = user ? humanizeRole(user.role) : "";
  // Prefer the real profile name/clan; fall back to the role while it loads.
  const displayName = profile?.fullName || roleLabel || "Signed in";
  const subtitle = profile?.clan?.name
    ?? (user?.verified === false ? "Pending verification" : roleLabel || "Signed in");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/assets/TriboLogo_NoBackground.png" alt="Tribo" width="30" height="30" />
          Tribo
        </div>

        <div className="nav-section">Main</div>
        {NAV.map((item) => {
          const active = item.path != null && pathname.startsWith(item.path);
          return (
            <button
              key={item.id}
              className={"nav-item " + (active ? "active" : "")}
              disabled={item.path == null}
              onClick={() => item.path && navigate(item.path)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.path == null && <span className="soon">soon</span>}
            </button>
          );
        })}

        <div className="nav-section">Account</div>
        <button className="nav-item" disabled>
          <Icon name="bell" size={18} />
          <span>Notifications</span>
          <span className="soon">soon</span>
        </button>
        <button className="nav-item" disabled>
          <Icon name="settings" size={18} />
          <span>Settings</span>
          <span className="soon">soon</span>
        </button>
        <button className="nav-item" onClick={onSignOut}>
          <Icon name="logout" size={18} />
          <span>Sign out</span>
        </button>

        <div className="sidebar-bottom">
          <Avatar name={displayName} color={profile?.avatarColor} size="sm" />
          <div className="who">
            <strong>{displayName}</strong>
            <small>{subtitle}</small>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
