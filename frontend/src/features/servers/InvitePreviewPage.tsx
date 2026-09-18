import { useNavigate, useParams } from 'react-router-dom';
import { AuthCard } from '../auth/AuthCard';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Spinner } from '../../components/Spinner';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import { useInvitePreview, useJoinServer, useServers } from './hooks';

/**
 * Public landing page for a shared invite link (/invite/:code) — reachable whether or not the
 * visitor is signed in (see AppRouter, outside ProtectedRoute). Login/register preserve the
 * invite via `state: { from }`, which safeRedirectTarget (features/auth/hooks.ts) allows back
 * to this same route once the user is authenticated.
 */
export function InvitePreviewPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const previewQuery = useInvitePreview(code);
  const { data: servers } = useServers(isAuthenticated);
  const joinServerMutation = useJoinServer();

  if (previewQuery.isPending) {
    return (
      <AuthCard title="Convite">
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      </AuthCard>
    );
  }

  if (previewQuery.isError) {
    return (
      <AuthCard title="Convite">
        <ErrorBanner message="Este convite é inválido ou expirou." />
      </AuthCard>
    );
  }

  const preview = previewQuery.data;
  const returnTo = `/invite/${code}`;
  const alreadyMember = servers?.some((server) => server.id === preview.serverId) ?? false;

  return (
    <AuthCard title={preview.serverName}>
      <p className="text-center text-body text-muted">
        {preview.memberCount} {preview.memberCount === 1 ? 'membro' : 'membros'}
      </p>

      {!isAuthenticated && (
        <div className="flex flex-col gap-2">
          <Button type="button" className="w-full" onClick={() => navigate('/login', { state: { from: returnTo } })}>
            Entrar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/register', { state: { from: returnTo } })}
          >
            Criar conta
          </Button>
        </div>
      )}

      {isAuthenticated && alreadyMember && (
        <div className="space-y-2">
          <p className="text-center text-body text-muted">Você já está neste servidor.</p>
          <Button type="button" className="w-full" onClick={() => navigate(`/app/servers/${preview.serverId}`)}>
            Ir para o servidor
          </Button>
        </div>
      )}

      {isAuthenticated && !alreadyMember && (
        <>
          <ErrorBanner
            message={joinServerMutation.error instanceof ApiError ? joinServerMutation.error.message : null}
          />
          <Button
            type="button"
            className="w-full"
            disabled={joinServerMutation.isPending}
            onClick={() => joinServerMutation.mutate({ code: code! })}
          >
            {joinServerMutation.isPending ? 'Entrando…' : 'Entrar no servidor'}
          </Button>
        </>
      )}
    </AuthCard>
  );
}
