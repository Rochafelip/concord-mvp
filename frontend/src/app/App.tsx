import { useEffect } from 'react';
import { Spinner } from '../components/Spinner';
import { useMe } from '../features/auth/hooks';
import { useAuthStore } from '../features/auth/authStore';
import { AppRouter } from '../routes/AppRouter';

export function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // Boot-time (and refresh-time) session validation: if we believe we're logged in, confirm
  // the session cookie is still valid and refresh the user's profile. If it's invalid,
  // apiClient's 401 handling clears the store and the app naturally falls back to the login page.
  const meQuery = useMe();

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  // We believe we're logged in but haven't confirmed it / hydrated the user yet: show a
  // loading state instead of flashing the login page for an already-logged-in user on refresh.
  const isBootstrapping = isAuthenticated && user == null && meQuery.isPending;

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <AppRouter />;
}
