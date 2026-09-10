import type { ReactNode } from 'react';
import { Logo } from '../../components/Logo';
import { ConcordBackdrop } from '../../components/illustrations/ConcordBackdrop';

interface AuthCardProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4 py-8">
      <ConcordBackdrop className="absolute inset-0 h-full w-full opacity-60" />

      <div className="relative w-full max-w-sm space-y-4 rounded-lg border bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex justify-center">
          <Logo size={32} />
        </div>

        <h1 className="text-center text-title font-semibold text-ink">{title}</h1>

        {children}

        {footer && <footer className="text-center text-body text-muted">{footer}</footer>}
      </div>
    </div>
  );
}
