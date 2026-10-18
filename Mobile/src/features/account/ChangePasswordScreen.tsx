import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { AppText, Button, FormSection, Screen, TextField } from '@/components';
import { getErrorMessage, isApiError } from '@/services/api';
import { SIGN_OUT_REASONS, useSession } from '@/services/session';

import { changePassword } from './api';

const MIN_LENGTH = 8;
const MAX_BYTES = 72;

type Field = 'oldPassword' | 'newPassword' | 'confirmPassword';
type Errors = Partial<Record<Field, string>>;

function utf8Length(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

export function validatePasswordChange(v: { oldPassword: string; newPassword: string; confirmPassword: string }): Errors {
  const errors: Errors = {};
  if (!v.oldPassword) errors.oldPassword = 'Enter your current password.';
  if (!v.newPassword) errors.newPassword = 'Enter a new password.';
  else if (v.newPassword.length < MIN_LENGTH) errors.newPassword = `Use at least ${MIN_LENGTH} characters.`;
  else if (utf8Length(v.newPassword) > MAX_BYTES) errors.newPassword = 'This password is too long.';
  else if (v.newPassword === v.oldPassword) errors.newPassword = 'Choose a password different from your current one.';
  if (!errors.newPassword && v.confirmPassword !== v.newPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

/**
 * Change password (all roles). On success the server revokes every session
 * (`reauthRequired`), so we sign out locally with an explanatory message.
 */
export function ChangePasswordScreen() {
  const { endSession, canWrite } = useSession();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const mutation = useMutation({
    mutationFn: () => changePassword({ oldPassword, newPassword }),
    onSuccess: async () => {
      // The server revoked all tokens (tokenVersion++), so the local session is no longer valid.
      await endSession(SIGN_OUT_REASONS.passwordChanged, { revokeRemote: false });
    },
    onError: (e) => {
      if (isApiError(e) && e.kind === 'cancelled') return;
      const field = isApiError(e) ? (e.details as { field?: string } | undefined)?.field : undefined;
      if (field === 'oldPassword' || field === 'newPassword' || field === 'confirmPassword') {
        setErrors({ [field]: getErrorMessage(e) });
        setFormError(null);
      } else {
        setFormError(getErrorMessage(e));
      }
    },
  });

  const submit = async () => {
    setFormError(null);
    const v = validatePasswordChange({ oldPassword, newPassword, confirmPassword });
    setErrors(v);
    if (Object.keys(v).length) return;
    await mutation.mutateAsync().catch(() => undefined);
  };

  return (
    <Screen keyboardAvoiding footer={<Button label="Change password" onPress={submit} loading={mutation.isPending} disabled={!canWrite} />}>
      <FormSection description="After changing your password you will be signed out on all devices, including this one.">
        {!canWrite ? (
          <AppText variant="secondary" color="warning">
            You are offline. Connect to the internet to change your password.
          </AppText>
        ) : null}
        {formError ? (
          <AppText variant="body" color="danger" accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {formError}
          </AppText>
        ) : null}
        <TextField
          label="Current password"
          value={oldPassword}
          onChangeText={setOldPassword}
          secure
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => newRef.current?.focus()}
          error={errors.oldPassword}
          required
        />
        <TextField
          ref={newRef}
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          helper={`At least ${MIN_LENGTH} characters.`}
          error={errors.newPassword}
          required
        />
        <TextField
          ref={confirmRef}
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={errors.confirmPassword}
          required
        />
      </FormSection>
    </Screen>
  );
}
