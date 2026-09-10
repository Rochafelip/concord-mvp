import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { ProtectedRoute } from './ProtectedRoute';

/** Renders whatever `from` the redirect carried, so the test can assert on it. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="from">{(location.state as { from?: string } | null)?.from ?? ''}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LocationProbe />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });

  it('redirects to /login when unauthenticated', () => {
    renderWithRouter();

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('carries the attempted route, including its query string, to the login screen', () => {
    renderAt('/app/servers/s1/channels/c1?tab=files');

    expect(screen.getByTestId('from')).toHaveTextContent('/app/servers/s1/channels/c1?tab=files');
  });

  it('renders children when authenticated', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: '1', username: 'a', displayName: 'A', email: 'a@b.com', avatarUrl: null },
    });

    renderWithRouter();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});
