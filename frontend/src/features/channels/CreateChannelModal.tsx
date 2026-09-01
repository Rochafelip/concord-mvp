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
  onClose: () => void;
}

export function CreateChannelModal({ serverId, open, onClose }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('TEXT');
  const createChannelMutation = useCreateChannel(serverId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createChannelMutation.mutate(
      { name, type },
      {
        onSuccess: () => {
          setName('');
          setType('TEXT');
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
        <h2 className="text-lg font-semibold text-gray-900">Create a channel</h2>

        <ErrorBanner message={errorMessage} />

        <TextInput
          label="Channel name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-gray-700">Type</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="type"
              value="TEXT"
              checked={type === 'TEXT'}
              onChange={() => setType('TEXT')}
            />
            Text
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="type"
              value="VOICE"
              checked={type === 'VOICE'}
              onChange={() => setType('VOICE')}
            />
            Voice
          </label>
        </fieldset>

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
