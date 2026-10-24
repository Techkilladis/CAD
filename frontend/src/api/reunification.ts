import { apiClient } from './client';
import type { PublicCaseHit, ReportInput, ReunificationCase, ReunificationStatus } from './types';

export const reportMissing = (data: ReportInput) =>
  apiClient.post<{ id: string; status: ReunificationStatus; message: string }>('/reunification', data).then((r) => r.data);
export const publicSearch = (q: string) => apiClient.get<PublicCaseHit[]>('/reunification/public-search', { params: { q } }).then((r) => r.data);
export const listCases = (f: { q?: string; status?: ReunificationStatus } = {}) =>
  apiClient.get<ReunificationCase[]>('/reunification', { params: f }).then((r) => r.data);
export const updateCase = (id: string, data: { status?: ReunificationStatus; staffNotes?: string | null; matchedCheckinId?: string | null }) =>
  apiClient.patch<ReunificationCase>(`/reunification/${id}`, data).then((r) => r.data);
