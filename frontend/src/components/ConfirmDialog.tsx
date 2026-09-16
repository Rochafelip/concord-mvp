import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Shown on the confirm button while `pending` — defaults to `confirmLabel`. */
  pendingLabel?: string;
  /** Renders the confirm button in the danger variant, for destructive actions. */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The design-system replacement for `window.confirm` — same "ask before doing something
 * irreversible" job, but themed like the rest of the app and testable without stubbing a
 * browser global. Confirming does not close the dialog; the caller closes it once its
 * mutation settles, so the pending state stays visible.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pendingLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-72 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{title}</h2>
        <p className="text-body text-muted">{message}</p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'primary'}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
