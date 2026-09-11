interface ErrorBannerProps {
  message: string | null | undefined;
  variant?: 'error' | 'info';
}

export function ErrorBanner({ message, variant = 'error' }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`rounded border px-3 py-2 text-body ${
        variant === 'info'
          ? 'border-brand/30 bg-brand/10 text-brand'
          : 'border-danger/30 bg-danger/10 text-danger'
      }`}
    >
      {message}
    </div>
  );
}
