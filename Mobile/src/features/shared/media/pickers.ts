/**
 * Shared native pickers for uploads.
 *
 * Images (profileImage, companyLogo, logo, image): system photo library → re-encoded as JPEG
 * (longest side ≤ 2048 px). Re-encoding converts HEIC/HEIF and other formats the server rejects,
 * strips EXIF orientation issues, and keeps files under the 5 MB server limit.
 * PDFs (payslip): system document picker, copied into the app cache, size-checked.
 *
 * A cancelled picker is NOT an error: callers get { status: 'canceled' } and should do nothing.
 */
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

/** Server-side limit for images and PDFs (see Backend middleware/upload.js and pdfUpload.js). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2048;

export type PickedFile = { uri: string; name: string; type: string; size: number | null };

export type PickResult =
  | { status: 'picked'; file: PickedFile }
  | { status: 'canceled' }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string };

function fileSize(uri: string): number | null {
  try {
    const f = new File(uri);
    return typeof f.size === 'number' ? f.size : null;
  } catch {
    return null;
  }
}

function safeBaseName(name: string | null | undefined, fallback: string): string {
  const base = (name ?? '').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60);
  return base || fallback;
}

/** Opens the app's system settings page (used after a permission denial). */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

export async function pickImage(options: { aspect?: [number, number]; allowsEditing?: boolean } = {}): Promise<PickResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // On Android 13+ the system photo picker works without a granted permission; only stop when
    // the OS reports a hard denial that cannot be asked again.
    if (!permission.granted && permission.canAskAgain === false && permission.accessPrivileges !== 'limited') {
      return { status: 'denied', message: 'Photo access is turned off for Hakirush. You can allow it in Settings.' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      allowsEditing: options.allowsEditing ?? false,
      aspect: options.aspect,
      quality: 1,
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return { status: 'canceled' };

    const asset = result.assets[0];
    const longest = Math.max(asset.width ?? 0, asset.height ?? 0);
    const context = ImageManipulator.manipulate(asset.uri);
    if (longest > MAX_IMAGE_EDGE) {
      if ((asset.width ?? 0) >= (asset.height ?? 0)) context.resize({ width: MAX_IMAGE_EDGE });
      else context.resize({ height: MAX_IMAGE_EDGE });
    }
    const rendered = await context.renderAsync();
    let saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    let size = fileSize(saved.uri);
    if (size !== null && size > MAX_UPLOAD_BYTES) {
      // Rare for a 2048 px JPEG, but retry once with stronger compression before giving up.
      saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
      size = fileSize(saved.uri);
    }
    if (size !== null && size > MAX_UPLOAD_BYTES) {
      return { status: 'error', message: 'This photo is too large to upload (limit 5 MB). Please choose another photo.' };
    }

    return {
      status: 'picked',
      file: { uri: saved.uri, name: `${safeBaseName(asset.fileName, 'photo')}.jpg`, type: 'image/jpeg', size },
    };
  } catch {
    return { status: 'error', message: 'This photo could not be opened. Please choose a JPEG or PNG image.' };
  }
}

/** Capture a photo directly from the device camera (used for receipts and expense bills). */
export async function captureCameraImage(options: { allowsEditing?: boolean } = {}): Promise<PickResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied', message: 'Camera access is turned off for Hakirush. You can allow it in Settings.' };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      allowsEditing: options.allowsEditing ?? true,
      quality: 1,
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return { status: 'canceled' };

    const asset = result.assets[0];
    const longest = Math.max(asset.width ?? 0, asset.height ?? 0);
    const context = ImageManipulator.manipulate(asset.uri);
    if (longest > MAX_IMAGE_EDGE) {
      if ((asset.width ?? 0) >= (asset.height ?? 0)) context.resize({ width: MAX_IMAGE_EDGE });
      else context.resize({ height: MAX_IMAGE_EDGE });
    }
    const rendered = await context.renderAsync();
    let saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    let size = fileSize(saved.uri);
    if (size !== null && size > MAX_UPLOAD_BYTES) {
      saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
      size = fileSize(saved.uri);
    }
    if (size !== null && size > MAX_UPLOAD_BYTES) {
      return { status: 'error', message: 'This receipt photo is too large to upload (limit 5 MB).' };
    }

    return {
      status: 'picked',
      file: { uri: saved.uri, name: `${safeBaseName(asset.fileName, 'receipt')}.jpg`, type: 'image/jpeg', size },
    };
  } catch {
    return { status: 'error', message: 'Could not access the camera. Please try again or choose from your photos.' };
  }
}

export async function pickPdf(): Promise<PickResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return { status: 'canceled' };

    const asset = result.assets[0];
    const size = typeof asset.size === 'number' ? asset.size : fileSize(asset.uri);
    if (size !== null && size > MAX_UPLOAD_BYTES) {
      return { status: 'error', message: 'This PDF is larger than 5 MB. Please choose a smaller file.' };
    }
    const looksPdf = asset.mimeType === 'application/pdf' || /\.pdf$/i.test(asset.name ?? '');
    if (!looksPdf) return { status: 'error', message: 'Please choose a PDF file.' };

    return {
      status: 'picked',
      file: { uri: asset.uri, name: `${safeBaseName(asset.name, 'payslip')}.pdf`, type: 'application/pdf', size },
    };
  } catch {
    return { status: 'error', message: 'The document could not be opened. Please try again.' };
  }
}
