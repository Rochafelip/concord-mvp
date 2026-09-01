import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { useCreateServer } from './hooks';

interface CreateServerModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateServerModal({ open, onClose }: CreateServerModalProps) {
  const [name, setName] = useState('');
  const createServerMutation = useCreateServer();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createServerMutation.mutate(
      { name },
      {
        onSuccess: () => {
          setName('');
          onClose();
        },
      },
    );
  }

  const errorMessage =
    createServerMutation.error instanceof ApiError
      ? createServerMutation.error.message
      : createServerMutation.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-72 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Create a server</h2>

        <ErrorBanner message={errorMessage} />

        <TextInput
          label="Server name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createServerMutation.isPending}>
            {createServerMutation.isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
