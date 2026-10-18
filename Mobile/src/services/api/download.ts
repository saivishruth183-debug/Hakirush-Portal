/**
 * Authenticated downloads into the app-private cache + sharing.
 *
 * Uses the SDK 57 expo-file-system object API (`File`, `Directory`, `Paths`,
 * `File.downloadFileAsync(url, destination, { headers, idempotent })`).
 * Files land in `<cache>/private-downloads/`, which `clearPrivateFiles()` wipes on logout.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { authState } from './authState';
import { getValidAccessToken, refreshSession, type QueryParams } from './client';
import { buildUrl } from './config';
import { ApiError } from './errors';

const PRIVATE_DIR_NAME = 'private-downloads';

function privateDir(): Directory {
  return new Directory(Paths.cache, PRIVATE_DIR_NAME);
}

/** Keep only safe filename characters; never allow path separators. */
export function sanitizeFileName(name: string, fallback = 'download'): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned || fallback;
}

function mapDownloadError(e: unknown): ApiError {
  const message = e instanceof Error ? e.message : String(e);
  const status = /status:?\s*(\d{3})/i.exec(message)?.[1];
  if (status) {
    const code = Number(status);
    return new ApiError({
      kind: 'http',
      status: code,
      message: code === 404 ? 'This file is not available.' : code === 403 ? 'You do not have access to this file.' : 'The download failed.',
    });
  }
  return new ApiError({ kind: 'network', message: 'The download failed. Check your connection and try again.' });
}

export interface DownloadOptions {
  query?: QueryParams;
  /** Send the bearer token (default true). */
  auth?: boolean;
}

/**
 * Download `/api/...` (authenticated) into the private cache as `fileName` (overwrites).
 * Returns the local File (use `.uri`).
 */
export async function downloadToPrivateCache(path: string, fileName: string, opts: DownloadOptions = {}): Promise<File> {
  const generation = authState.getGeneration();
  const url = buildUrl(path, opts.query);
  const dir = privateDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, sanitizeFileName(fileName));

  const attempt = async (): Promise<File> => {
    const token = opts.auth === false ? null : await getValidAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return File.downloadFileAsync(url, target, { headers, idempotent: true });
  };

  let file: File;
  try {
    file = await attempt();
  } catch (e) {
    const err = mapDownloadError(e);
    if (err.status === 401 && opts.auth !== false && authState.getRefreshToken()) {
      await refreshSession();
      try {
        file = await attempt();
      } catch (e2) {
        throw mapDownloadError(e2);
      }
    } else {
      throw err;
    }
  }
  if (generation !== authState.getGeneration()) {
    try {
      file.delete();
    } catch {
      // ignore
    }
    throw new ApiError({ kind: 'cancelled', message: 'Discarded: the session changed during download' });
  }
  return file;
}

/** Opens the system share sheet for a local file. Returns false when sharing is unavailable. */
export async function shareFile(file: File | string, options: { mimeType?: string; dialogTitle?: string } = {}): Promise<boolean> {
  const uri = typeof file === 'string' ? file : file.uri;
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: options.mimeType,
    dialogTitle: options.dialogTitle,
    UTI: options.mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
  return true;
}

/** Write a text file (e.g. CSV export) into the private cache. */
export function writePrivateTextFile(fileName: string, contents: string): File {
  const dir = privateDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, sanitizeFileName(fileName));
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  return file;
}

/** Deletes every file the app downloaded/exported. Called on logout and account switch. */
export async function clearPrivateFiles(): Promise<void> {
  try {
    const dir = privateDir();
    if (dir.exists) dir.delete();
  } catch {
    // Best effort: the OS may already have purged the cache.
  }
}
