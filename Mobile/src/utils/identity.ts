import { avatarPalette } from '@/theme/tokens';
import type { Role } from '@/types/api';

/** Up to two initials from a display name ("Asha Rao" → "AR", "madonna" → "M"). */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0])[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** Stable 32-bit FNV-1a hash. */
export function stableHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic avatar background for an id (falls back to the name). */
export function avatarColorFor(seed: string | null | undefined): string {
  const key = seed && seed.length ? seed : '?';
  return avatarPalette[stableHash(key) % avatarPalette.length];
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  employee: 'Employee',
  client: 'Client',
};

/** Root route for each role's shell. */
export function homeHrefForRole(role: Role): '/admin' | '/employee' | '/client' {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'client':
      return '/client';
    case 'employee':
    default:
      return '/employee';
  }
}
