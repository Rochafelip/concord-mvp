import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PasswordInput } from '../../components/PasswordInput';
import { TextInput } from '../../components/TextInput';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { PasswordRequirements } from '../auth/PasswordRequirements';
import { isPasswordValid } from '../auth/passwordPolicy';
import { AudioSettingsSection } from './audio/AudioSettingsSection';
import { useChangePassword, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from './hooks';

const NEW_PASSWORD_REQUIREMENTS_ID = 'new-password-requirements';

function errorMessage(error: unknown): string | null {
  if (error instanceof ApiError) return error.message;
  if (error) return 'Algo deu errado. Tente novamente.';
  return null;
}

export function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const notificationPreferences = useNotificationStore((state) => state.preferences);
  const setNotificationPreferences = useNotificationStore((state) => state.setPreferences);
  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadAvatar();
  const removeAvatarMutation = useRemoveAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setAvatarError(
        !allowed.includes(file.type)
          ? 'Selecione uma imagem JPEG, PNG, GIF ou WebP'
          : 'A imagem deve ter no máximo 5 MB',
      );
      uploadAvatarMutation.reset();
      return;
    }
    setAvatarError(null);
    uploadAvatarMutation.mutate(file);
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
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-8 p-4 sm:p-8">
        <h1 className="text-title font-semibold text-ink">Configurações</h1>

        <section className="space-y-4">
          <h2 className="text-heading font-medium text-ink">Notificações</h2>
          <p className="text-body text-muted">
            Escolha quais avisos de novas mensagens aparecem no sistema. Mensagens de erro
            importantes continuam sendo exibidas.
          </p>
          <label className="flex items-start gap-3 text-body text-ink">
            <input
              type="checkbox"
              checked={notificationPreferences.messageNotifications}
              onChange={(event) =>
                setNotificationPreferences({ messageNotifications: event.target.checked })
              }
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Mensagens dos canais</span>
              <span className="text-caption text-muted">
                Avisar quando alguém enviar uma mensagem em um canal de texto.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-body text-ink">
            <input
              type="checkbox"
              checked={notificationPreferences.onboardingNotifications}
              onChange={(event) =>
                setNotificationPreferences({ onboardingNotifications: event.target.checked })
              }
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Onboarding</span>
              <span className="text-caption text-muted">
                Avisar sobre entradas e eventos no canal de onboarding.
              </span>
            </span>
          </label>
        </section>

        <form onSubmit={handleProfileSubmit} className="space-y-4" noValidate>
          <h2 className="text-heading font-medium text-ink">Perfil</h2>
          <ErrorBanner message={errorMessage(updateProfileMutation.error)} />
          <ErrorBanner
            message={
              avatarError ??
              (uploadAvatarMutation.error
                ? uploadAvatarMutation.error instanceof ApiError && uploadAvatarMutation.error.status === 413
                  ? 'A imagem deve ter no máximo 5 MB'
                  : errorMessage(uploadAvatarMutation.error)
                : errorMessage(removeAvatarMutation.error)
              )
            }
          />
          {profileSaved && <p className="text-body text-brand">Perfil atualizado com sucesso</p>}

          <div className="flex items-center gap-4 rounded border border-border bg-surface p-4">
            <Avatar displayName={user?.displayName ?? ''} avatarUrl={user?.avatarUrl} size="lg" loading={uploadAvatarMutation.isPending} />
            <div className="space-y-2">
              <p className="text-body font-medium text-ink">Foto de perfil</p>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  onChange={handleAvatarChange}
                />
                <Button type="button" disabled={uploadAvatarMutation.isPending || removeAvatarMutation.isPending} onClick={() => fileInputRef.current?.click()}>
                  {uploadAvatarMutation.isPending ? 'Enviando…' : user?.avatarUrl ? 'Alterar' : 'Adicionar'}
                </Button>
                {user?.avatarUrl && (
                  <Button type="button" disabled={uploadAvatarMutation.isPending || removeAvatarMutation.isPending} onClick={() => removeAvatarMutation.mutate()}>
                    {removeAvatarMutation.isPending ? 'Removendo…' : 'Remover'}
                  </Button>
                )}
              </div>
              <p className="text-caption text-muted">JPEG, PNG, GIF ou WebP · máximo de 5 MB</p>
            </div>
          </div>

          <TextInput
            label="Nome de usuário"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextInput
            label="Nome de exibição"
            name="displayName"
            autoComplete="nickname"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <Button type="submit" disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? 'Salvando…' : 'Salvar perfil'}
          </Button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
          <h2 className="text-heading font-medium text-ink">Senha</h2>
          <ErrorBanner
            message={
              passwordMismatch
                ? 'A nova senha e a confirmação não coincidem'
                : errorMessage(changePasswordMutation.error)
            }
          />
          {passwordSaved && <p className="text-body text-brand">Senha alterada com sucesso</p>}

          <PasswordInput
            label="Senha atual"
            name="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <div className="space-y-2">
            <PasswordInput
              ref={newPasswordRef}
              label="Nova senha"
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
            label="Confirmar nova senha"
            name="confirmNewPassword"
            autoComplete="new-password"
            required
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
          />
          <Button type="submit" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? 'Salvando…' : 'Alterar senha'}
          </Button>
        </form>

        <AudioSettingsSection />
      </div>
    </div>
  );
}
