import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../app/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { useAuthStore } from '../features/auth/authStore';
import { ProtectedRoute } from './ProtectedRoute';

// Placeholder for /app/servers/:serverId. The real server/channel sidebar and chat UI are
// built by a later task — this route just needs to exist and render something minimal.
function ServerPlaceholder() {
  return <div className="p-4 text-gray-500">Select a channel</div>;
}

// Placeholder for /app/servers/:serverId/channels/:channelId — same reasoning as above.
function ChannelPlaceholder() {
  return <div className="p-4 text-gray-500">Channel view coming soon</div>;
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
        <Route path="servers/:serverId" element={<ServerPlaceholder />} />
        <Route path="servers/:serverId/channels/:channelId" element={<ChannelPlaceholder />} />
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
  );
}
