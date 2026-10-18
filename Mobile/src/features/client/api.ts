/**
 * Client self-service data (Backend/routes/clientRoute.js + announcementRoutes.js).
 *
 * Every read goes through react-query with keys from useQueryKeys() (all scoped to the signed-in
 * user). Shapes follow Backend/controllers/clientController.js (`clientDto`, `rosterDto`,
 * `galleryDto`, `loadStandings`) and announcementController.js (`forViewer`).
 */
import { useQueryClient } from '@tanstack/react-query';

import { api } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import type { Announcement, ApiSuccess, Client, GalleryImage, PerformanceResponse, RosterEntry } from '@/types/api';

// ---------- Response shapes ----------
export interface MyClientResponse extends ApiSuccess {
  client: Client;
}

export interface RosterResponse extends ApiSuccess {
  entries: RosterEntry[];
}

export interface AddRosterResponse extends ApiSuccess {
  entry: RosterEntry;
}

export interface GalleryResponse extends ApiSuccess {
  images: GalleryImage[];
}

/** Non-admin view of an announcement: `seen` is added and `seenBy` holds at most the caller. */
export type ClientAnnouncement = Announcement & { seen?: boolean };

export interface AnnouncementsResponse extends ApiSuccess {
  announcements: ClientAnnouncement[];
}

export interface AnnouncementResponse extends ApiSuccess {
  announcement: ClientAnnouncement;
}

export interface MarkReadResponse extends ApiSuccess {
  announcementId: string;
  seen: true;
  message?: string;
}

export interface RosterInput {
  name: string;
  jerseySize: string;
}

// ---------- Server limits (Backend/models/ClientRosterEntry.js) ----------
export const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type JerseySizeValue = (typeof JERSEY_SIZES)[number];
export const ROSTER_NAME_MAX = 80;
export const ROSTER_MAX_ENTRIES = 200;

/** Labels as on the web form (ClientRelationship.jsx). */
export const JERSEY_SIZE_LABELS: Record<JerseySizeValue, string> = {
  XS: 'XS - Extra Small',
  S: 'S - Small',
  M: 'M - Medium',
  L: 'L - Large',
  XL: 'XL - Extra Large',
  XXL: 'XXL - Double Large',
};

// ---------- Reads ----------
export function useMyClient() {
  const keys = useQueryKeys();
  return useApiQuery<MyClientResponse>(keys.myClient(), '/api/client/me');
}

export function useRoster() {
  const keys = useQueryKeys();
  return useApiQuery<RosterResponse>(keys.roster(), '/api/client/me/roster');
}

export function useGallery() {
  const keys = useQueryKeys();
  return useApiQuery<GalleryResponse>(keys.gallery(), '/api/client/me/gallery');
}

export function usePerformance() {
  const keys = useQueryKeys();
  return useApiQuery<PerformanceResponse>(keys.performance(), '/api/client/me/performance');
}

export function useClientAnnouncements() {
  const keys = useQueryKeys();
  return useApiQuery<AnnouncementsResponse>(keys.announcements(), '/api/announcements/public');
}

/**
 * One announcement. While it loads, the matching row from the cached list is shown
 * (placeholderData), so opening an update from the list is instant and works offline.
 */
export function useAnnouncement(id: string) {
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  return useApiQuery<AnnouncementResponse>(keys.announcement(id), `/api/announcements/${encodeURIComponent(id)}`, {
    enabled: !!id,
    placeholderData: () => {
      const list = queryClient.getQueryData<AnnouncementsResponse>(keys.announcements());
      const found = list?.announcements?.find((a) => a._id === id);
      return found ? { success: true, announcement: found } : undefined;
    },
  });
}

// ---------- Writes ----------
export function useAddRosterEntry() {
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  return useApiMutation((input: RosterInput) => api.post<AddRosterResponse>('/api/client/me/roster', input), {
    onSuccess: (res) => {
      // Show the new entry immediately (the server returns newest first), then re-sync.
      queryClient.setQueryData<RosterResponse>(keys.roster(), (prev) =>
        prev ? { ...prev, entries: [res.entry, ...prev.entries.filter((e) => e._id !== res.entry._id)] } : prev,
      );
      return queryClient.invalidateQueries({ queryKey: keys.roster() });
    },
  });
}

export function useDeleteRosterEntry() {
  const keys = useQueryKeys();
  return useApiMutation(
    (entryId: string) => api.delete<ApiSuccess>(`/api/client/me/roster/${encodeURIComponent(entryId)}`),
    { invalidate: [keys.roster()] },
  );
}

/** PUT /api/announcements/:id/read — only adds the caller; updates the cached list + detail. */
export function useMarkAnnouncementRead() {
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  return useApiMutation(
    (id: string) => api.put<MarkReadResponse>(`/api/announcements/${encodeURIComponent(id)}/read`),
    {
      onSuccess: (res) => {
        const id = String(res.announcementId);
        queryClient.setQueryData<AnnouncementsResponse>(keys.announcements(), (prev) =>
          prev ? { ...prev, announcements: prev.announcements.map((a) => (a._id === id ? { ...a, seen: true } : a)) } : prev,
        );
        queryClient.setQueryData<AnnouncementResponse>(keys.announcement(id), (prev) =>
          prev ? { ...prev, announcement: { ...prev.announcement, seen: true } } : prev,
        );
      },
    },
  );
}
