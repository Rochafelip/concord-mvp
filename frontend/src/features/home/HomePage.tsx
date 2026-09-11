import {
  Activity,
  ArrowRight,
  Clock3,
  MessageCircle,
  Mic2,
  Server,
  Users,
  Volume2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../auth/authStore';
import { getLastVisitedTextChannelId } from '../channels/lastVisitedChannel';
import { useChannels } from '../channels/hooks';
import { getServerMembers } from '../servers/api';
import { useServers } from '../servers/hooks';
import { getVoicePresence } from '../calls/api';
import type { VoicePresenceEntry } from '../../types/voice';

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recentemente';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const { data: servers = [], isLoading: serversLoading } = useServers();
  const memberQueries = useQueries({
    queries: servers.map((server) => ({
      queryKey: ['servers', server.id, 'members'],
      queryFn: () => getServerMembers(server.id),
    })),
  });
  const presenceQueries = useQueries({
    queries: servers.map((server) => ({
      queryKey: ['servers', server.id, 'voice-presence'],
      queryFn: () => getVoicePresence(server.id),
    })),
  });

  const members = memberQueries.flatMap((query) => query.data ?? []);
  const uniqueMembers = Array.from(
    new Map(members.map((member) => [member.user.id, member])).values(),
  );
  const onlineIds = new Set(
    presenceQueries.flatMap((query) => (query.data ?? []).map((entry: VoicePresenceEntry) => entry.userId)),
  );
  const friends = uniqueMembers
    .filter((member) => member.user.id !== user?.id)
    .sort((a, b) => Number(onlineIds.has(b.user.id)) - Number(onlineIds.has(a.user.id)))
    .slice(0, 6);
  const favoriteServer = [...servers].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
  const { data: favoriteChannels = [] } = useChannels(favoriteServer?.id);
  const lastChannelId = favoriteServer ? getLastVisitedTextChannelId(favoriteServer.id) : null;
  const lastChannel = favoriteChannels.find((channel) => channel.id === lastChannelId);
  const activeFriends = friends.filter((member) => onlineIds.has(member.user.id));
  const recentServers = [...servers]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  return (
    <div className="h-full overflow-y-auto bg-app">
      <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
        <header>
          <p className="text-small font-medium uppercase tracking-[0.18em] text-brand">Seu espaço no Concord</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">
            Olá, {user?.displayName ?? 'por aqui'} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 text-body text-muted">Veja o que está acontecendo nos seus servidores.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo">
          <SummaryCard icon={<Users size={20} />} label="Pessoas nos seus servidores" value={uniqueMembers.length} />
          <SummaryCard icon={<Volume2 size={20} />} label="Online em chamadas" value={activeFriends.length} />
          <SummaryCard icon={<Server size={20} />} label="Servidores" value={servers.length} />
          <SummaryCard icon={<Activity size={20} />} label="Servidores ativos" value={recentServers.length} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-small font-medium text-brand">🏆 Seu espaço em destaque</p>
                <h2 className="mt-2 text-heading font-semibold text-ink">
                  {favoriteServer?.name ?? 'Crie ou entre em um servidor'}
                </h2>
                <p className="mt-1 text-body text-muted">
                  {favoriteServer ? `Última atividade ${formatRelativeDate(favoriteServer.updatedAt)}.` : 'Comece a construir sua comunidade.'}
                </p>
              </div>
              {favoriteServer && (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-xl font-semibold text-white">
                  {favoriteServer.name.trim().charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            {favoriteServer ? (
              <Link
                to={`/app/servers/${favoriteServer.id}`}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-body font-medium text-white hover:bg-brand-hover"
              >
                Entrar no servidor <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <Link to="/app" className="mt-6 inline-flex items-center gap-2 text-body font-medium text-brand">
                Use a barra lateral para começar <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 size={19} className="text-brand" aria-hidden="true" />
              <h2 className="text-heading font-semibold text-ink">Continue de onde parou</h2>
            </div>
            {favoriteServer ? (
              <Link
                to={lastChannel ? `/app/servers/${favoriteServer.id}/channels/${lastChannel.id}` : `/app/servers/${favoriteServer.id}`}
                className="mt-5 block rounded-xl bg-app p-4 hover:bg-brand/10"
              >
                <p className="text-small text-muted">Último servidor com atividade</p>
                <p className="mt-1 font-medium text-ink">{favoriteServer.name}</p>
                <p className="mt-2 text-small text-brand">
                  {lastChannel ? `💬 #${lastChannel.name}` : 'Voltar para a conversa'} →
                </p>
              </Link>
            ) : (
              <p className="mt-5 text-body text-muted">Suas atividades recentes aparecerão aqui.</p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <DashboardPanel
            title="Pessoas online"
            icon={<Users size={19} className="text-brand" aria-hidden="true" />}
            action={friends.length > 0 ? `${friends.length} pessoas` : undefined}
          >
            {serversLoading ? (
              <p className="text-body text-muted">Carregando pessoas...</p>
            ) : friends.length === 0 ? (
              <p className="text-body text-muted">Entre em um servidor para encontrar pessoas.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {friends.map((member) => (
                  <div key={member.user.id} className="flex items-center gap-3 rounded-xl bg-app p-3">
                    <div className="relative">
                      <Avatar displayName={member.displayName ?? member.user.displayName} avatarUrl={member.user.avatarUrl} />
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-app ${onlineIds.has(member.user.id) ? 'bg-success' : 'bg-muted'}`}
                        aria-label={onlineIds.has(member.user.id) ? 'Online' : 'Offline'}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-body font-medium text-ink">{member.displayName ?? member.user.displayName}</p>
                      <p className="text-small text-muted">{onlineIds.has(member.user.id) ? 'Em chamada' : 'Offline'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Atividade recente"
            icon={<Activity size={19} className="text-brand" aria-hidden="true" />}
          >
            {recentServers.length === 0 ? (
              <p className="text-body text-muted">Ainda não há atividade para mostrar.</p>
            ) : (
              <div className="space-y-3">
                {recentServers.map((server) => (
                  <Link key={server.id} to={`/app/servers/${server.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-app">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand">
                      <MessageCircle size={17} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body text-ink">Você esteve no servidor <strong>{server.name}</strong></p>
                      <p className="text-small text-muted">{formatRelativeDate(server.updatedAt)}</p>
                    </div>
                    <ArrowRight size={16} className="text-muted" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </DashboardPanel>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Mic2 size={19} className="text-brand" aria-hidden="true" />
            <h2 className="text-heading font-semibold text-ink">Seus servidores</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentServers.map((server) => (
              <Link key={server.id} to={`/app/servers/${server.id}`} className="rounded-xl border border-line bg-app p-4 hover:border-brand">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-semibold text-white">
                  {server.name.trim().charAt(0).toUpperCase() || '?'}
                </div>
                <p className="mt-3 truncate font-medium text-ink">{server.name}</p>
                <p className="mt-1 text-small text-muted">Abrir servidor →</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand">{icon}</div>
      <p className="mt-4 text-small text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function DashboardPanel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-heading font-semibold text-ink">{title}</h2>
        </div>
        {action && <span className="text-small text-muted">{action}</span>}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}
