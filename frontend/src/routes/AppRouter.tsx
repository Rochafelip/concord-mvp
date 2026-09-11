import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../app/AppShell';
import { ChannelRoute } from '../app/ChannelRoute';
import { ServerIndexRoute } from '../app/ServerIndexRoute';
import { ServerLayout } from '../app/ServerLayout';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';
import { useAuthStore } from '../features/auth/authStore';
import { HomePage } from '../features/home/HomePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProtectedRoute } from './ProtectedRoute';

// Catch-all target: send authenticated users back into the app, everyone else to /login.
function CatchAllRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/app' : '/login'} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="servers/:serverId" element={<ServerLayout />}>
          <Route index element={<ServerIndexRoute />} />
          <Route path="channels/:channelId" element={<ChannelRoute />} />
        </Route>
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
  );
}
