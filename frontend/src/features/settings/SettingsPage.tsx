import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import { useChangePassword, useUpdateProfile } from './hooks';

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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const changePasswordMutation = useChangePassword();

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaved(false);
    if (newPassword !== confirmNewPassword) {
      setPasswordMismatch(true);
      return;
    }
    setPasswordMismatch(false);
    changePasswordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
          setPasswordSaved(true);
          setTimeout(() => setPasswordSaved(false), 2000);
        },
      },
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-8 p-8">
        <h1 className="text-title font-semibold text-ink">Settings</h1>

        <form onSubmit={handleProfileSubmit} className="space-y-4" noValidate>
          <h2 className="text-heading font-medium text-ink">Profile</h2>
          <ErrorBanner message={errorMessage(updateProfileMutation.error)} />
          {profileSaved && <p className="text-body text-brand">Profile updated successfully</p>}

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

        <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
          <h2 className="text-heading font-medium text-ink">Password</h2>
          <ErrorBanner
            message={
              passwordMismatch
                ? 'New password and confirmation do not match'
                : errorMessage(changePasswordMutation.error)
            }
          />
          {passwordSaved && <p className="text-body text-brand">Password changed successfully</p>}

          <TextInput
            label="Current password"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextInput
            label="New password"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextInput
            label="Confirm new password"
            type="password"
            name="confirmNewPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
          />
          <Button type="submit" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
