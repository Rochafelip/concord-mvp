import { Outlet } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useAuthStore } from '../features/auth/authStore';

/**
 * Minimal authenticated-area layout: a header with the current user and a logout button,
 * plus an <Outlet/> for nested routes. The server/channel sidebar and chat UI are built by
 * a later task inside the <Outlet/> area — this is intentionally just the shell.
 */
export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <span className="font-semibold text-gray-900">Concord</span>

        {user && (
          <div className="flex items-center gap-3">
            <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} />
            <span className="text-sm text-gray-700">{user.displayName}</span>
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
