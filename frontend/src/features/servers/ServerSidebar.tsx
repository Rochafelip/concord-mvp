import { Plus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CreateServerModal } from './CreateServerModal';
import { useServers } from './hooks';
import { JoinServerModal } from './JoinServerModal';

/**
 * The persistent far-left "server rail" (Discord-style icon list). Selection is derived
 * from the URL's :serverId param, not duplicated into Zustand — see ARCHITECTURE.md's
 * URL-as-source-of-truth pattern already used by ProtectedRoute/AppRouter.
 */
export function ServerSidebar() {
  const { serverId } = useParams<{ serverId: string }>();
  const { data: servers } = useServers();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <nav
      aria-label="Servers"
      className="flex w-16 flex-shrink-0 flex-col items-center gap-2 overflow-y-auto border-r bg-rail py-3"
    >
      <button
        type="button"
        aria-label="Join server"
        title="Join a server"
        onClick={() => setJoinOpen(true)}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sidebar text-muted hover:bg-brand/20 hover:text-brand"
      >
        <UserPlus size={17} aria-hidden="true" />
      </button>

      {(servers ?? []).map((server) => {
        const isSelected = server.id === serverId;
        const initial = server.name.trim().charAt(0).toUpperCase() || '?';

        return (
          <div key={server.id} className="relative flex w-full items-center justify-center">
            {isSelected && (
              <span className="absolute left-0 h-8 w-1 rounded-r bg-brand" aria-hidden="true" />
            )}
            <Link
              to={`/app/servers/${server.id}`}
              aria-label={server.name}
              aria-current={isSelected ? 'page' : undefined}
              title={server.name}
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-body font-semibold transition-colors ${
                isSelected ? 'bg-brand text-white' : 'bg-sidebar text-muted hover:bg-brand/20'
              }`}
            >
              {initial}
            </Link>
          </div>
        );
      })}

      <div className="flex w-full flex-col items-center gap-2 border-t pt-2">
        <button
          type="button"
          aria-label="Create server"
          onClick={() => setCreateOpen(true)}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sidebar text-muted hover:bg-brand/20"
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>

      <CreateServerModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinServerModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </nav>
  );
}
