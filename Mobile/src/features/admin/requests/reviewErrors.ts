import { toast } from '@/components';
import { getErrorMessage, isApiError } from '@/services/api';

/**
 * Shared error handling for leave / correction reviews.
 * 409 ALREADY_REVIEWED (another admin was first) → info toast + refetch; cancelled → ignored.
 * Returns true when the request was already reviewed.
 */
export function handleReviewError(e: unknown, onAlreadyReviewed: () => unknown): boolean {
  if (isApiError(e) && e.kind === 'cancelled') return false;
  if (isApiError(e) && e.status === 409) {
    const status = (e.details as { status?: string } | undefined)?.status;
    toast.info(
      status
        ? `This request was already reviewed (now ${status}). The latest status is shown.`
        : 'This request was already reviewed by another admin. The latest status is shown.',
    );
    void onAlreadyReviewed();
    return true;
  }
  toast.error(getErrorMessage(e));
  return false;
}
