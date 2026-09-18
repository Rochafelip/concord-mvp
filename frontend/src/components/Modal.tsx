import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Minimal shared modal shell — backdrop + centered panel, closes on backdrop click, the
 * close button, or Escape. Used by the create-server, join-server, create-channel, and
 * server-settings dialogs.
 *
 * Built on Radix's Dialog primitive for focus-trap/Escape handling, but deliberately not
 * rendered through Dialog.Portal or Dialog.Overlay: Content itself is styled as the fullscreen
 * backdrop (same single-element-per-layer shape the old hand-rolled version had), so
 * z-[100] — which must stay above every other fixed-position overlay in the app (currently
 * ScreenShareTile's fullscreen mode at z-50) — keeps working exactly as before.
 */
export function Modal({ open, onClose, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Content aria-describedby={undefined} onClick={onClose} asChild>
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="relative rounded bg-surface p-6 shadow-lg"
            onClick={(event: MouseEvent) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            <Dialog.Title className="sr-only">Dialog</Dialog.Title>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded text-muted hover:text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
