import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../app/AppShell';
import { ChannelRoute } from '../app/ChannelRoute';
import { NoServerSelected } from '../app/NoServerSelected';
import { ServerIndexRoute } from '../app/ServerIndexRoute';
import { ServerLayout } from '../app/ServerLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { useAuthStore } from '../features/auth/authStore';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProtectedRoute } from './ProtectedRoute';

// Catch-all target: send authenticated users back into the app, everyone else to /login.
function CatchAllRedirect() {
  const token = useAuthStore((state) => state.token);
  return <Navigate to={token ? '/app' : '/login'} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<NoServerSelected />} />
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
