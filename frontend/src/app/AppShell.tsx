import { Outlet } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useAuthStore } from '../features/auth/authStore';
import { ServerSidebar } from '../features/servers/ServerSidebar';

/**
 * Authenticated-area layout: a header with the current user and a logout button, the
 * persistent ServerSidebar (far-left server rail, visible across every nested /app route),
 * and an <Outlet/> for the rest — server/channel-specific layout lives in ServerLayout,
 * nested one level deeper under /app/servers/:serverId.
 */
export function AppShell() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2">
        <span className="font-semibold text-gray-900">Concord</span>

        {/* Gated on `token`, not `user`: if the backend is briefly unreachable during boot
            rehydration (network error, not a 401), `token` stays set but `user` never
            populates — the logout button must still be reachable in that case. */}
        {token && (
          <div className="flex items-center gap-3">
            {user && (
              <>
                <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} />
                <span className="text-sm text-gray-700">{user.displayName}</span>
              </>
            )}
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ServerSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
