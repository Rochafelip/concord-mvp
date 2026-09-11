import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import type { ChannelType } from '../../types/channel';
import { useCreateChannel } from './hooks';

interface CreateChannelModalProps {
  serverId: string;
  open: boolean;
  type: Exclude<ChannelType, 'ONBOARDING'>;
  onClose: () => void;
}

export function CreateChannelModal({ serverId, open, type, onClose }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const createChannelMutation = useCreateChannel(serverId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createChannelMutation.mutate(
      { name, type },
      {
        onSuccess: () => {
          setName('');
          onClose();
        },
      },
    );
  }

  const errorMessage =
    createChannelMutation.error instanceof ApiError
      ? createChannelMutation.error.message
      : createChannelMutation.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-72 space-y-4">
        <h2 className="text-heading font-semibold text-ink">
          Create a {type === 'TEXT' ? 'text' : 'voice'} channel
        </h2>

        <ErrorBanner message={errorMessage} />

        <TextInput
          label="Channel name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createChannelMutation.isPending}>
            {createChannelMutation.isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
