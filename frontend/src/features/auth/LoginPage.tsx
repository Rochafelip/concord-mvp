import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { TextInput } from '../../components/TextInput';
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-2xl font-semibold text-gray-900">Log in</h1>

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

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
