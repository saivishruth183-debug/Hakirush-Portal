import { api } from '@/services/api';
import type { ChangePasswordRequest, ChangePasswordResponse } from '@/types/api';

/** PUT /api/setting/change-password — target is always the signed-in user. */
export function changePassword(body: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  return api.put<ChangePasswordResponse>('/api/setting/change-password', body);
}
