/**
 * Shared bits for the admin entity screens (clients, sponsors, stalls).
 */
import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button, confirm, toast } from '@/components';
import { api } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';

import { isSilentError, writeErrorMessage } from '../people/common/forms';

export interface DeleteButtonProps {
  /** e.g. "sponsor" */
  noun: string;
  name: string;
  path: string;
  /** Extra sentence for the confirmation (what else is removed). */
  consequence?: string;
  /** List keys to invalidate; `detailKey` is removed from the cache. */
  invalidate: QueryKey[];
  detailKey: QueryKey;
  onError: (message: string | null) => void;
}

/** Destructive "Delete <noun>" button: confirm → DELETE → toast → back to the list. */
export function DeleteEntityButton({ noun, name, path, consequence, invalidate, detailKey, onError }: DeleteButtonProps) {
  const { canWrite } = useSession();
  const queryClient = useQueryClient();
  const remove = useApiMutation(() => api.delete<{ success: true }>(path), { invalidate });
  const onPress = async () => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      message: `This permanently deletes the ${noun}. ${consequence ?? ''} This cannot be undone.`.replace(/\s+/g, ' ').trim(),
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    onError(null);
    try {
      await remove.mutateAsync(undefined);
      queryClient.removeQueries({ queryKey: detailKey });
      toast.success(`${name} was deleted.`);
      router.back();
    } catch (e) {
      if (!isSilentError(e)) onError(writeErrorMessage(e));
    }
  };
  return <Button label={`Delete ${noun}`} icon="trash-outline" variant="destructive" onPress={onPress} disabled={!canWrite} testID="entity-delete" />;
}

/** Form state helper: values + per-field errors that clear on edit. */
export function useEntityForm<F extends string>(initial: Record<F, string>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({});
  const set = (f: F) => (v: string) => {
    setValues((p) => ({ ...p, [f]: v }));
    setErrors((p) => (p[f] ? { ...p, [f]: undefined } : p));
  };
  return { values, setValues, errors, setErrors, set };
}
