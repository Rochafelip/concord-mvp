import { APP_VERSION } from '../version';

const GITHUB_URL = 'https://github.com/Rochafelip';

/** GitHub's official mark — not in lucide-react (brand icons were dropped from that package). */
function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.96.1-.75.4-1.25.73-1.54-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.43-2.71 5.4-5.29 5.69.42.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .3.2.66.79.55A10.52 10.52 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
    </svg>
  );
}

/**
 * Small "about the software" strip shown below the auth cards (Login/Register/etc.) — version,
 * copyright year, and the developer's GitHub. Not shown in the authenticated app: AppShell is a
 * fixed-height, no-scroll layout (like Discord) with no room for a persistent footer without
 * eating into chat/call space.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-4 flex items-center justify-center gap-3 text-caption text-muted">
      <span>Concord v{APP_VERSION}</span>
      <span aria-hidden="true">·</span>
      <span>© {year} Felipe Rocha</span>
      <span aria-hidden="true">·</span>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:text-ink"
      >
        <GithubIcon />
        GitHub
      </a>
    </footer>
  );
}
