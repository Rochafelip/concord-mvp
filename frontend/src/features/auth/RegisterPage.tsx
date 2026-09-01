import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { useRegister } from './hooks';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const registerMutation = useRegister();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    registerMutation.mutate({ username, displayName, email, password });
  }

  const errorMessage =
    registerMutation.error instanceof ApiError
      ? registerMutation.error.message
      : registerMutation.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-2xl font-semibold text-gray-900">Create an account</h1>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorBanner message={errorMessage} />

          <TextInput
            label="Username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <TextInput
            label="Display name"
            name="displayName"
            autoComplete="nickname"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <Button type="submit" disabled={registerMutation.isPending} className="w-full">
            {registerMutation.isPending ? 'Creating account…' : 'Register'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
