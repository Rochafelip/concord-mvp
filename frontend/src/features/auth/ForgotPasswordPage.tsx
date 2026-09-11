import { useMutation } from '@tanstack/react-query';
import { MailQuestion } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { AuthCard } from './AuthCard';
import { requestPasswordReset } from './api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [invalidEmail, setInvalidEmail] = useState(false);
  const mutation = useMutation({ mutationFn: requestPasswordReset });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setInvalidEmail(!valid);
    if (valid) mutation.mutate(email);
  }

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Algo deu errado. Tente novamente.'
        : null;

  return (
    <AuthCard
      title="Esqueceu sua senha?"
      footer={
        <Link to="/login" className="font-medium text-brand hover:text-brand-hover">
          Voltar para o login
        </Link>
      }
    >
      {mutation.isSuccess ? (
        <div
          role="status"
          className="flex gap-3 rounded border border-success/30 bg-success/10 px-3 py-2 text-body text-ink"
        >
          <MailQuestion size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
          <p>Se existir uma conta com esse e-mail, enviamos um link de recuperação.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorBanner message={errorMessage} />
          <TextInput
            label="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setInvalidEmail(false);
            }}
          />
          {invalidEmail && <ErrorBanner message="Digite um e-mail válido." />}
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? 'Enviando…' : 'Enviar link de recuperação'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
