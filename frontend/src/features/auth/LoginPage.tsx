import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Logo } from '../../components/Logo';
import { TextInput } from '../../components/TextInput';
import { ConcordBackdrop } from '../../components/illustrations/ConcordBackdrop';
import { ApiError } from '../../services/apiClient';
import { useLogin } from './hooks';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  const errorMessage =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4">
      <ConcordBackdrop className="absolute inset-0 h-full w-full opacity-60" />

      <div className="relative w-full max-w-sm space-y-4 rounded-lg border bg-surface p-8 shadow-sm">
        <div className="flex justify-center">
          <Logo size={32} />
        </div>

        <h1 className="text-center text-title font-semibold text-ink">Log in</h1>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorBanner message={errorMessage} />

          <TextInput
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <TextInput
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <Button type="submit" disabled={loginMutation.isPending} className="w-full">
            {loginMutation.isPending ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <p className="text-center text-body text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-brand hover:text-brand-hover">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
