/**
 * Persistent session storage (SecureStore = Android Keystore / iOS Keychain).
 * Only the refresh token and a minimal, non-sensitive user snapshot are stored.
 * The access token is NEVER persisted.
 */
import * as SecureStore from 'expo-secure-store';

import type { Role, SessionUser } from '@/types/api';

const KEY_REFRESH = 'hakirush.session.refreshToken';
const KEY_SNAPSHOT = 'hakirush.session.userSnapshot';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** What we keep for an offline boot: role shell + display name + ids. No email, no HR data. */
export interface UserSnapshot {
  _id: string;
  name: string;
  role: Role;
  employeeId?: string;
  employeeRecordId?: string;
  departmentId?: string | null;
  departmentName?: string;
  designation?: string;
  clientId?: string;
  clientCode?: string | null;
  profileImage?: string;
}

export function toSnapshot(user: SessionUser): UserSnapshot {
  return {
    _id: user._id,
    name: user.name,
    role: user.role,
    employeeId: user.employeeId,
    employeeRecordId: user.employeeRecordId,
    departmentId: user.departmentId ?? null,
    departmentName: user.departmentName,
    designation: user.designation,
    clientId: user.clientId,
    clientCode: user.clientCode,
    profileImage: user.profileImage,
  };
}

/** Rebuilds a SessionUser from a snapshot (email is unknown offline → ''). */
export function fromSnapshot(s: UserSnapshot): SessionUser {
  return {
    _id: s._id,
    name: s.name,
    email: '',
    role: s.role,
    employeeId: s.employeeId,
    employeeRecordId: s.employeeRecordId,
    departmentId: s.departmentId ?? null,
    departmentName: s.departmentName,
    designation: s.designation,
    clientId: s.clientId,
    clientCode: s.clientCode,
    profileImage: s.profileImage,
  };
}

function isValidSnapshot(v: unknown): v is UserSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<UserSnapshot>;
  return (
    typeof s._id === 'string' &&
    typeof s.name === 'string' &&
    (s.role === 'admin' || s.role === 'employee' || s.role === 'client')
  );
}

// ---- raw (unqueued) operations ----
async function rawGetRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_REFRESH, OPTIONS);
  } catch {
    return null;
  }
}
async function rawGetSnapshot(): Promise<UserSnapshot | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_SNAPSHOT, OPTIONS);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
const del = (key: string) => SecureStore.deleteItemAsync(key, OPTIONS).catch(() => undefined);

async function rawRemoveSnapshotIfOwned(userId: string): Promise<void> {
  const snapshot = await rawGetSnapshot();
  if (!snapshot || snapshot._id !== userId) return;
  if (await rawGetRefreshToken()) return; // a live session owns it
  await del(KEY_SNAPSHOT);
}

/**
 * All SecureStore operations run through one serial queue so that a slow write from an old
 * session can never land after (and clobber) a logout's clear or a newer session's write.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(op: () => Promise<T>): Promise<T> {
  const next = queue.then(op, op);
  queue = next.catch(() => undefined);
  return next;
}

export const sessionStorage = {
  getRefreshToken: (): Promise<string | null> => serial(rawGetRefreshToken),
  setRefreshToken: (token: string): Promise<void> => serial(() => SecureStore.setItemAsync(KEY_REFRESH, token, OPTIONS)),
  getSnapshot: (): Promise<UserSnapshot | null> => serial(rawGetSnapshot),
  setSnapshot: (snapshot: UserSnapshot): Promise<void> =>
    serial(() => SecureStore.setItemAsync(KEY_SNAPSHOT, JSON.stringify(snapshot), OPTIONS)),
  /**
   * Undo a stale write: delete the refresh token only if it is still the one we wrote, and the
   * snapshot only if it belongs to `userId` and no refresh token remains (a snapshot without a
   * token belongs to no live session). Never deletes a newer session's data.
   */
  removeIfOwned: (refreshToken: string, userId: string): Promise<void> =>
    serial(async () => {
      if ((await rawGetRefreshToken()) === refreshToken) await del(KEY_REFRESH);
      await rawRemoveSnapshotIfOwned(userId);
    }),
  removeSnapshotIfOwned: (userId: string): Promise<void> => serial(() => rawRemoveSnapshotIfOwned(userId)),
  clear: (): Promise<void> =>
    serial(async () => {
      await Promise.all([del(KEY_REFRESH), del(KEY_SNAPSHOT)]);
    }),
};

export const SESSION_STORAGE_KEYS = { refreshToken: KEY_REFRESH, snapshot: KEY_SNAPSHOT } as const;
