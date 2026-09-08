import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import { useUpdateProfile } from './hooks';

function errorMessage(error: unknown): string | null {
  if (error instanceof ApiError) return error.message;
  if (error) return 'Something went wrong. Please try again.';
  return null;
}

export function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [profileSaved, setProfileSaved] = useState(false);
  const updateProfileMutation = useUpdateProfile();

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaved(false);
    updateProfileMutation.mutate(
      { username, displayName },
      {
        onSuccess: () => {
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 2000);
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 p-8">
      <h1 className="text-2xl font-semibold text-ink">Settings</h1>

      <form onSubmit={handleProfileSubmit} className="space-y-4" noValidate>
        <h2 className="text-lg font-medium text-ink">Profile</h2>
        <ErrorBanner message={errorMessage(updateProfileMutation.error)} />
        {profileSaved && <p className="text-sm text-brand">Profile updated successfully</p>}

        <TextInput
          label="Username"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <TextInput
          label="Display name"
          name="displayName"
          autoComplete="nickname"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <Button type="submit" disabled={updateProfileMutation.isPending}>
          {updateProfileMutation.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </div>
  );
}
