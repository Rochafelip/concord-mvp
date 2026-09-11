import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PasswordInput } from '../../components/PasswordInput';
import { Spinner } from '../../components/Spinner';
import { ApiError } from '../../services/apiClient';
import { AuthCard } from './AuthCard';
import { PasswordRequirements } from './PasswordRequirements';
import { isPasswordValid } from './passwordPolicy';
import { resetPassword, verifyPasswordResetToken } from './api';

const REQUIREMENTS_ID = 'reset-password-requirements';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verifyMutation = useMutation({ mutationFn: verifyPasswordResetToken });
  const resetMutation = useMutation({ mutationFn: ({ password }: { password: string }) => resetPassword(token ?? '', password) });
  const started = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyMutation.mutate(token);
  }, [token, verifyMutation]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPasswordValid(password)) {
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirmation) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    resetMutation.mutate({ password });
  }

  if (!token) {
    return (
      <AuthCard title="Link inválido" footer={<Link to="/forgot-password" className="font-medium text-brand hover:text-brand-hover">Solicitar novo link</Link>}>
        <ErrorBanner message="O link de redefinição está incompleto." />
      </AuthCard>
    );
  }

  if (verifyMutation.isPending || verifyMutation.isIdle) {
    return (
      <AuthCard title="Validando link">
        <div className="flex justify-center py-4"><Spinner /></div>
      </AuthCard>
    );
  }

  if (verifyMutation.isError) {
    const message = verifyMutation.error instanceof ApiError
      ? verifyMutation.error.message
      : 'Algo deu errado. Tente novamente.';
    return (
      <AuthCard title="Link inválido ou expirado" footer={<Link to="/forgot-password" className="font-medium text-brand hover:text-brand-hover">Solicitar novo link</Link>}>
        <ErrorBanner message={message} />
      </AuthCard>
    );
  }

  if (resetMutation.isSuccess) {
    return (
      <AuthCard title="Senha alterada">
        <div className="flex flex-col items-center gap-3 py-2">
          <CheckCircle2 size={32} aria-hidden="true" className="text-success" />
          <p className="text-center text-body text-muted">Sua senha foi alterada com sucesso.</p>
          <Link to="/login" className="font-medium text-brand hover:text-brand-hover">Fazer login</Link>
        </div>
      </AuthCard>
    );
  }

  const resetError = resetMutation.error instanceof ApiError
    ? resetMutation.error.message
    : resetMutation.error
      ? 'Algo deu errado. Tente novamente.'
      : null;

  return (
    <AuthCard title="Redefinir sua senha">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={mismatch ? 'As senhas não coincidem' : resetError} />
        <div className="space-y-2">
          <PasswordInput
            ref={passwordRef}
            label="Nova senha"
            name="password"
            autoComplete="new-password"
            required
            aria-describedby={REQUIREMENTS_ID}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordRequirements id={REQUIREMENTS_ID} value={password} />
        </div>
        <PasswordInput
          label="Confirmar nova senha"
          name="confirmation"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button type="submit" disabled={resetMutation.isPending} className="w-full">
          {resetMutation.isPending ? 'Salvando…' : 'Confirmar nova senha'}
        </Button>
      </form>
    </AuthCard>
  );
}
