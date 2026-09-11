import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PasswordInput } from '../../components/PasswordInput';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { AuthCard } from './AuthCard';
import { useRegister } from './hooks';
import { PasswordRequirements } from './PasswordRequirements';
import { isPasswordValid } from './passwordPolicy';
import { isEmailValid } from './emailValidation';

const REQUIREMENTS_ID = 'password-requirements';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invalidEmail, setInvalidEmail] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const registerMutation = useRegister();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isEmailValid(email)) {
      setInvalidEmail(true);
      return;
    }

    if (!isPasswordValid(password)) {
      passwordRef.current?.focus();
      return;
    }

    registerMutation.mutate({ username, displayName, email, password });
  }

  const errorMessage =
    registerMutation.error instanceof ApiError
      ? registerMutation.error.message
      : registerMutation.error
        ? 'Algo deu errado. Tente novamente.'
        : null;

  return (
    <AuthCard
      title="Criar sua conta"
      footer={
        <>
          Já tem uma conta?{' '}
          <Link to="/login" className="font-medium text-brand hover:text-brand-hover">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={errorMessage} />

        <TextInput
          label="Nome de usuário"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <TextInput
          label="Nome de exibição"
          name="displayName"
          autoComplete="nickname"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />

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

        <div className="space-y-2">
          <PasswordInput
            ref={passwordRef}
            label="Senha"
            name="password"
            autoComplete="new-password"
            required
            aria-describedby={REQUIREMENTS_ID}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordRequirements id={REQUIREMENTS_ID} value={password} />
        </div>

        <Button type="submit" disabled={registerMutation.isPending} className="w-full">
          {registerMutation.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
    </AuthCard>
  );
}
