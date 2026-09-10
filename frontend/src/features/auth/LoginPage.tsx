import { useEffect, useState, type FormEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PasswordInput } from '../../components/PasswordInput';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { AuthCard } from './AuthCard';
import { useAuthStore } from './authStore';
import { useLogin } from './hooks';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  const sessionEndedReason = useAuthStore((state) => state.sessionEndedReason);
  const clearSessionEndedReason = useAuthStore((state) => state.clearSessionEndedReason);

  // Frozen at first render so the effect below can drop the reason from the store without the
  // notice vanishing from the screen in the same tick.
  const [sessionExpired] = useState(sessionEndedReason === 'expired');

  // Consumed on arrival: the notice belongs to this visit to the login screen, not the next one.
  useEffect(() => {
    if (sessionEndedReason) {
      clearSessionEndedReason();
    }
  }, [sessionEndedReason, clearSessionEndedReason]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  const errorMessage =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.error
        ? 'Algo deu errado. Tente novamente.'
        : null;

  return (
    <AuthCard
      title="Entrar"
      footer={
        <>
          Não tem uma conta?{' '}
          <Link to="/register" className="font-medium text-brand hover:text-brand-hover">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Not an ErrorBanner: an expired session isn't the user's mistake, and `warning` is
            already this app's language for "here's what happened". */}
        {sessionExpired && (
          <div
            role="status"
            className="flex gap-3 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-body text-ink"
          >
            <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
            <p>Sua sessão expirou. Entre novamente para continuar.</p>
          </div>
        )}

        <ErrorBanner message={errorMessage} />

        <TextInput
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div className="space-y-1">
          <PasswordInput
            label="Senha"
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
              Esqueceu sua senha?
            </Link>
          </div>
        </div>

        <Button type="submit" disabled={loginMutation.isPending} className="w-full">
          {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthCard>
  );
}
