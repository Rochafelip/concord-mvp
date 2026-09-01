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
      className="flex w-16 flex-shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-gray-200 bg-gray-50 py-3"
    >
      {(servers ?? []).map((server) => {
        const isSelected = server.id === serverId;
        const initial = server.name.trim().charAt(0).toUpperCase() || '?';

        return (
          <Link
            key={server.id}
            to={`/app/servers/${server.id}`}
            aria-label={server.name}
            aria-current={isSelected ? 'page' : undefined}
            title={server.name}
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              isSelected
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-indigo-100'
            }`}
          >
            {initial}
          </Link>
        );
      })}

      <button
        type="button"
        aria-label="Create server"
        onClick={() => setCreateOpen(true)}
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xl leading-none text-gray-700 hover:bg-indigo-100"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Join server"
        onClick={() => setJoinOpen(true)}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700 hover:bg-indigo-100"
      >
        Join
      </button>

      <CreateServerModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinServerModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </nav>
  );
}
