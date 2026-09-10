import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PasswordInput } from '../../components/PasswordInput';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import { PasswordRequirements } from '../auth/PasswordRequirements';
import { isPasswordValid } from '../auth/passwordPolicy';
import { AudioSettingsSection } from './audio/AudioSettingsSection';
import { useChangePassword, useUpdateProfile } from './hooks';

const NEW_PASSWORD_REQUIREMENTS_ID = 'new-password-requirements';

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
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const changePasswordMutation = useChangePassword();

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaved(false);

    // Mirrors com.concordmvp.auth.PasswordPolicy. The live requirement list below already says
    // which rule fails, so there's nothing to add to the error banner here.
    if (!isPasswordValid(newPassword)) {
      setPasswordMismatch(false);
      newPasswordRef.current?.focus();
      return;
    }

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

          <PasswordInput
            label="Current password"
            name="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <div className="space-y-2">
            <PasswordInput
              ref={newPasswordRef}
              label="New password"
              name="newPassword"
              autoComplete="new-password"
              required
              aria-describedby={NEW_PASSWORD_REQUIREMENTS_ID}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <PasswordRequirements id={NEW_PASSWORD_REQUIREMENTS_ID} value={newPassword} />
          </div>
          <PasswordInput
            label="Confirm new password"
            name="confirmNewPassword"
            autoComplete="new-password"
            required
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
          />
          <Button type="submit" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </form>

        <AudioSettingsSection />
      </div>
    </div>
  );
}
