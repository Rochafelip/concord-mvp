import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Minimal shared modal shell — backdrop + centered panel, closes on backdrop click, the
 * close button, or Escape. Used by the create-server, join-server, create-channel, and
 * server-settings dialogs.
 */
export function Modal({ open, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative rounded bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded text-muted hover:text-ink"
        >
          <X size={18} aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
}
