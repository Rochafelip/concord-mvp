import { ConcordMark } from './ConcordMark';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ size = 24, showWordmark = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ConcordMark size={size} />
      {showWordmark && <span className="text-heading font-semibold text-ink">Concord</span>}
    </div>
  );
}
