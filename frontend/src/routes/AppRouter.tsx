import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../app/AppShell';
import { ServerLayout } from '../app/ServerLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { useAuthStore } from '../features/auth/authStore';
import { ChatWindow } from '../features/chat/ChatWindow';
import { ProtectedRoute } from './ProtectedRoute';

// Placeholder for /app (no server selected yet).
function NoServerSelected() {
  return <div className="p-4 text-gray-500">Select a server</div>;
}

// Placeholder for /app/servers/:serverId (no channel selected yet).
function NoChannelSelected() {
  return <div className="p-4 text-gray-500">Select a channel</div>;
}

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
        <Route path="servers/:serverId" element={<ServerLayout />}>
          <Route index element={<NoChannelSelected />} />
          <Route path="channels/:channelId" element={<ChatWindow />} />
        </Route>
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
  );
}
