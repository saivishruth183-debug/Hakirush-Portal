import { ApiError, downloadToPrivateCache, getErrorMessage, isApiError, shareFile } from '@/services/api';

import type { PayslipItem } from '../types';

export const LEGACY_MESSAGE = 'This older payslip file is being migrated; contact HR.';
export const NO_APP_MESSAGE =
  'No app on this phone can open or share PDFs. Install a PDF viewer (for example Google Drive or Adobe Acrobat) and try again.';

export type PayslipShareResult = { ok: true; message?: undefined } | { ok: false; message: string };

/** Maps download/share failures to user messages. A cancelled share sheet is not an error. */
export function payslipErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === 'LEGACY_FILE_NOT_MIGRATED' || e.status === 409) return LEGACY_MESSAGE;
    if (e.status === 404) return "This payslip's PDF isn't available. Contact HR.";
    if (e.status === 403) return 'You do not have access to this payslip.';
    if (e.code === 'FILE_UNAVAILABLE' || e.status === 502) return "The payslip file couldn't be fetched right now. Please try again later.";
    return getErrorMessage(e);
  }
  return NO_APP_MESSAGE;
}

function isShareCancel(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /cancel|dismiss/i.test(msg);
}

/** Downloads GET /api/payslip/:id/download into the private cache, then opens the share sheet. */
export async function sharePayslipPdf(p: PayslipItem): Promise<PayslipShareResult> {
  if (p.fileMigrationRequired) return { ok: false, message: LEGACY_MESSAGE };
  if (p.hasFile === false) return { ok: false, message: 'No PDF has been attached to this payslip yet. Contact HR.' };
  let file;
  try {
    file = await downloadToPrivateCache(`/api/payslip/${p._id}/download`, `payslip-${p.month}.pdf`);
  } catch (e) {
    if (e instanceof ApiError && e.kind === 'cancelled') return { ok: true };
    return { ok: false, message: payslipErrorMessage(e) };
  }
  try {
    const shared = await shareFile(file, { mimeType: 'application/pdf', dialogTitle: `Payslip ${p.month}` });
    return shared ? { ok: true } : { ok: false, message: NO_APP_MESSAGE };
  } catch (e) {
    if (isShareCancel(e)) return { ok: true };
    return { ok: false, message: NO_APP_MESSAGE };
  }
}
