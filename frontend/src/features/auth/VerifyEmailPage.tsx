import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Spinner } from '../../components/Spinner';
import { ApiError } from '../../services/apiClient';
import { AuthCard } from './AuthCard';
import { useAuthStore } from './authStore';
import { verifyEmail } from './api';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const verifyMutation = useMutation({
    mutationFn: verifyEmail,
    onSuccess: () => {
      if (user) setUser({ ...user, emailVerified: true });
    },
  });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyMutation.mutate(token);
  }, [token, verifyMutation]);

  if (!token) {
    return (
      <AuthCard
        title="Link inválido"
        footer={
          <Link to="/login" className="font-medium text-brand hover:text-brand-hover">
            Voltar para o login
          </Link>
        }
      >
        <ErrorBanner message="O link de confirmação está incompleto. Peça um novo e-mail de confirmação." />
      </AuthCard>
    );
  }

  if (verifyMutation.isPending || verifyMutation.isIdle) {
    return (
      <AuthCard title="Confirmando seu e-mail">
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      </AuthCard>
    );
  }

  if (verifyMutation.isError) {
    const message =
      verifyMutation.error instanceof ApiError
        ? verifyMutation.error.message
        : 'Algo deu errado. Tente novamente.';
    return (
      <AuthCard
        title="Link inválido ou expirado"
        footer={
          <Link
            to={isAuthenticated ? '/app' : '/login'}
            className="font-medium text-brand hover:text-brand-hover"
          >
            {isAuthenticated ? 'Voltar para o Concord' : 'Voltar para o login'}
          </Link>
        }
      >
        <ErrorBanner message={message} />
        <p className="mt-3 text-body text-muted">
          {isAuthenticated
            ? 'Use o botão “Reenviar e-mail” no aviso do topo para receber um link novo.'
            : 'Entre na sua conta e use o botão “Reenviar e-mail” no aviso do topo para receber um link novo.'}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Conta confirmada">
      <div className="flex flex-col items-center gap-3 py-2">
        <CheckCircle2 size={32} aria-hidden="true" className="text-success" />
        <p className="text-center text-body text-muted">Seu e-mail foi confirmado com sucesso.</p>
        <Link
          to={isAuthenticated ? '/app' : '/login'}
          className="font-medium text-brand hover:text-brand-hover"
        >
          {isAuthenticated ? 'Entrar no Concord' : 'Fazer login'}
        </Link>
      </div>
    </AuthCard>
  );
}
