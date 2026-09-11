import { Moon, Settings, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';
import { useAuthStore } from '../features/auth/authStore';
import { VerifyEmailBanner } from '../features/auth/VerifyEmailBanner';
import { VoiceConnectionBar } from '../features/calls/VoiceConnectionBar';
import { useDisconnectVoiceOnLogout } from '../features/calls/hooks';
import { ServerSidebar } from '../features/servers/ServerSidebar';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useTheme } from '../hooks/useTheme';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * Authenticated-area layout: a header with the current user and a logout button, the
 * persistent ServerSidebar (far-left server rail, visible across every nested /app route),
 * and an <Outlet/> for the rest — server/channel-specific layout lives in ServerLayout,
 * nested one level deeper under /app/servers/:serverId.
 *
 * Also the single mount point for useRealtimeSync: AppShell only renders once authenticated
 * (per ProtectedRoute), so this is the right place to own the WebSocket connection's lifecycle
 * for the whole authenticated area.
 */
export function AppShell() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useRealtimeSync();
  useDisconnectVoiceOnLogout();
  const notification = useNotificationStore((state) => state.message);
  const clearNotification = useNotificationStore((state) => state.clear);
  const { theme, toggle } = useTheme();

  return (
    <div className="flex h-screen flex-col bg-app">
      <header className="flex flex-shrink-0 items-center justify-between border-b bg-surface px-4 py-2">
        <Logo />

        {/* Gated on `isAuthenticated`, not `user`: if the backend is briefly unreachable during
            boot rehydration (network error, not a 401), `isAuthenticated` stays set but `user`
            never populates — the logout button must still be reachable in that case. */}
        {isAuthenticated && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
              onClick={toggle}
              className="flex h-10 w-10 items-center justify-center rounded text-muted hover:text-ink"
            >
              {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <Link
              to="/app/settings"
              aria-label="Configurações"
              className="flex h-10 w-10 items-center justify-center rounded text-muted hover:text-ink"
            >
              <Settings size={18} aria-hidden="true" />
            </Link>
            {user && (
              <>
                <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} />
                <span className="text-body text-ink">{user.displayName}</span>
              </>
            )}
            <Button
              variant="secondary"
              aria-label="Sair do Concord"
              onClick={() => setConfirmingLogout(true)}
            >
              Sair
            </Button>
          </div>
        )}
      </header>

      {user && user.emailVerified === false && <VerifyEmailBanner />}

      {/* Logging out drops the session and every open call with it, so it asks first. */}
      <Modal open={confirmingLogout} onClose={() => setConfirmingLogout(false)}>
        <h2 className="text-heading font-medium text-ink">Sair do Concord?</h2>
        <p className="mt-2 max-w-xs text-body text-muted">
          Você precisará entrar novamente para voltar aos seus servidores.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmingLogout(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setConfirmingLogout(false);
              logout();
            }}
          >
            Sair
          </Button>
        </div>
      </Modal>

      {notification && (
        <div className="flex flex-shrink-0 items-center gap-2 px-4 pt-2">
          <div className="flex-1">
            <ErrorBanner message={notification} />
          </div>
          <button
            type="button"
            aria-label="Dispensar aviso"
            onClick={clearNotification}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-danger hover:text-danger-hover"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ServerSidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      <VoiceConnectionBar />
    </div>
  );
}
