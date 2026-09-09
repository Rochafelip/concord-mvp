import { Logo } from '../components/Logo';
import { ConcordBackdrop } from '../components/illustrations/ConcordBackdrop';

/** Rendered at /app (no server selected yet). */
export function NoServerSelected() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-app">
      <ConcordBackdrop className="absolute inset-0 h-full w-full" />
      <div className="relative flex flex-col items-center gap-3">
        <Logo size={40} />
        <p className="text-body text-muted">Select a server</p>
      </div>
    </div>
  );
}
