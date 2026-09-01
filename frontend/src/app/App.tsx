import { useEffect } from 'react';
import { Spinner } from '../components/Spinner';
import { useMe } from '../features/auth/hooks';
import { useAuthStore } from '../features/auth/authStore';
import { AppRouter } from '../routes/AppRouter';

export function App() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // Boot-time (and refresh-time) session validation: if a token was persisted, confirm it's
  // still valid and refresh the user's profile. If the token is invalid, apiClient's 401
  // handling clears the store and the app naturally falls back to the login page.
  const meQuery = useMe();

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  // A token exists but we haven't confirmed it / hydrated the user yet: show a loading
  // state instead of flashing the login page for an already-logged-in user on refresh.
  const isBootstrapping = token != null && user == null && meQuery.isPending;

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <AppRouter />;
}
