import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { useJoinServer } from './hooks';

interface JoinServerModalProps {
  open: boolean;
  onClose: () => void;
}

export function JoinServerModal({ open, onClose }: JoinServerModalProps) {
  const [code, setCode] = useState('');
  const joinServerMutation = useJoinServer();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    joinServerMutation.mutate(
      { code },
      {
        onSuccess: () => {
          setCode('');
          onClose();
        },
      },
    );
  }

  const errorMessage =
    joinServerMutation.error instanceof ApiError
      ? joinServerMutation.error.message
      : joinServerMutation.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-72 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Join a server</h2>

        <ErrorBanner message={errorMessage} />

        <TextInput
          label="Invite code"
          name="code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={joinServerMutation.isPending}>
            {joinServerMutation.isPending ? 'Joining…' : 'Join'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
