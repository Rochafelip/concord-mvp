interface ErrorBannerProps {
  message: string | null | undefined;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
