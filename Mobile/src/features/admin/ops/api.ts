/**
 * Admin operations API calls (paths and bodies taken from the backend controllers).
 * Reads pass the react-query `signal`; writes are wrapped in useApiMutation by the screens.
 */
import { api, toFormData, type UploadFile } from '@/services/api';

import type {
  AnnouncementResponse,
  AnnouncementsResponse,
  CorrectionReviewResponse,
  CorrectionsResponse,
  HolidaysResponse,
  LeaveDetailResponse,
  LeaveListResponse,
  LeaveReviewResponse,
  ManualStatus,
  NotificationsResponse,
  UpdateAttendanceResponse,
} from './types';

export const PAGE_SIZE = 50;

/** status filter value "All" means no filter (the server treats "All" the same way). */
const statusParam = (status: string) => (status && status !== 'All' ? status : undefined);

export function fetchLeavePage(status: string, page: number, signal?: AbortSignal) {
  return api.get<LeaveListResponse>('/api/leave', { query: { status: statusParam(status), page, limit: PAGE_SIZE }, signal });
}

export function fetchCorrectionPage(status: string, page: number, signal?: AbortSignal) {
  return api.get<CorrectionsResponse>('/api/attendance-request', {
    query: { status: statusParam(status), page, limit: PAGE_SIZE },
    signal,
  });
}

/** PUT /api/leave/:id — admin review; 409 ALREADY_REVIEWED when it is no longer Pending. */
export function reviewLeave(leaveId: string, status: 'Approved' | 'Rejected') {
  return api.put<LeaveReviewResponse>(`/api/leave/${encodeURIComponent(leaveId)}`, { status });
}

export function fetchLeaveDetail(leaveId: string, signal?: AbortSignal) {
  return api.get<LeaveDetailResponse>(`/api/leave/detail/${encodeURIComponent(leaveId)}`, { signal });
}

/** PUT /api/attendance-request/:id/review — body `{decision, remarks?}` (remarks ≤ 500). */
export function reviewCorrection(requestId: string, decision: 'Approved' | 'Rejected', remarks: string) {
  const trimmed = remarks.trim();
  return api.put<CorrectionReviewResponse>(`/api/attendance-request/${encodeURIComponent(requestId)}/review`, {
    decision,
    ...(trimmed ? { remarks: trimmed } : {}),
  });
}

/** PUT /api/attendance/update/:employeeId (Employee._id) — `{status, date?}` (date ≤ today). */
export function updateAttendanceStatus(employeeRecordId: string, status: ManualStatus, date: string) {
  return api.put<UpdateAttendanceResponse>(`/api/attendance/update/${encodeURIComponent(employeeRecordId)}`, { status, date });
}

export function addHoliday(body: { title: string; date: string }) {
  return api.post<{ success: true; holiday: HolidaysResponse['holidays'][number] }>('/api/holiday/add', body);
}

export function deleteHoliday(id: string) {
  return api.delete<{ success: true }>(`/api/holiday/${encodeURIComponent(id)}`);
}

export interface AnnouncementInput {
  title: string;
  description: string;
  type: 'Annual' | 'Quarterly' | 'Celebration';
  date: string;
  venue: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
}

export function createAnnouncement(input: AnnouncementInput, image: UploadFile | null) {
  return api.post<AnnouncementResponse>('/api/announcements/add', toFormData({ ...input }, { image }));
}

export function updateAnnouncement(id: string, input: AnnouncementInput, image: UploadFile | null) {
  return api.put<AnnouncementResponse>(`/api/announcements/${encodeURIComponent(id)}`, toFormData({ ...input }, { image }));
}

export function deleteAnnouncement(id: string) {
  return api.delete<{ success: true }>(`/api/announcements/${encodeURIComponent(id)}`);
}

export function fetchAnnouncements(signal?: AbortSignal) {
  return api.get<AnnouncementsResponse>('/api/announcements', { signal });
}

export function fetchNotificationPage(page: number, limit: number, signal?: AbortSignal) {
  return api.get<NotificationsResponse>('/api/notifications', { query: { page, limit }, signal });
}

export function markNotificationSeen(id: string) {
  return api.patch<{ success: true }>(`/api/notifications/${encodeURIComponent(id)}/seen`, {});
}

export function markAllNotificationsSeen() {
  return api.patch<{ success: true; modified: number }>('/api/notifications/seen-all', {});
}
