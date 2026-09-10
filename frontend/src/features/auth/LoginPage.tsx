import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PasswordInput } from '../../components/PasswordInput';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { AuthCard } from './AuthCard';
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
    <AuthCard
      title="Log in"
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-brand hover:text-brand-hover">
            Register
          </Link>
        </>
      }
    >
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

        <div className="space-y-1">
          <PasswordInput
            label="Password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-caption font-medium text-brand hover:text-brand-hover"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <Button type="submit" disabled={loginMutation.isPending} className="w-full">
          {loginMutation.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthCard>
  );
}
