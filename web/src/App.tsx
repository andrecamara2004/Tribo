// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { HomePage } from "./pages/HomePage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { ActivityDetailPage } from "./pages/ActivityDetailPage";
import { ActivityFormPage } from "./pages/ActivityFormPage";

const MANAGER_ROLES = ["ACTIVITY_MANAGER", "PARTNER", "SYSADMIN"];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />

          <Route path="/activities" element={<ProtectedRoute><ActivitiesPage /></ProtectedRoute>} />
          <Route path="/activities/new" element={<ProtectedRoute roles={MANAGER_ROLES}><ActivityFormPage /></ProtectedRoute>} />
          <Route path="/activities/:id" element={<ProtectedRoute><ActivityDetailPage /></ProtectedRoute>} />
          <Route path="/activities/:id/edit" element={<ProtectedRoute roles={MANAGER_ROLES}><ActivityFormPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/activities" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}