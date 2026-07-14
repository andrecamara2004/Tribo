// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { TrackerPage } from "./pages/TrackerPage";
import { FeedPage } from "./pages/FeedPage";
import { ClanPage } from "./pages/ClanPage";
import { BackofficePage } from "./pages/BackofficePage";
import { FindActivityPage } from "./pages/FindActivityPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { ActivityDetailPage } from "./pages/ActivityDetailPage";
import { ActivityFormPage } from "./pages/ActivityFormPage";

const MANAGER_ROLES = ["ACTIVITY_MANAGER", "PARTNER", "SYSADMIN"];
const BACKOFFICE_ROLES = ["BACKOFFICE", "SYSADMIN"];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/track" element={<ProtectedRoute><TrackerPage /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
          <Route path="/clan" element={<ProtectedRoute><ClanPage /></ProtectedRoute>} />
          <Route path="/ranking" element={<Navigate to="/clan" replace />} />
          <Route path="/discover" element={<ProtectedRoute><FindActivityPage /></ProtectedRoute>} />

          <Route path="/activities" element={<ProtectedRoute><ActivitiesPage /></ProtectedRoute>} />
          <Route path="/activities/new" element={<ProtectedRoute roles={MANAGER_ROLES}><ActivityFormPage /></ProtectedRoute>} />
          <Route path="/activities/:id" element={<ProtectedRoute><ActivityDetailPage /></ProtectedRoute>} />
          <Route path="/activities/:id/edit" element={<ProtectedRoute roles={MANAGER_ROLES}><ActivityFormPage /></ProtectedRoute>} />

          <Route path="/backoffice" element={<ProtectedRoute roles={BACKOFFICE_ROLES}><BackofficePage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/activities" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}