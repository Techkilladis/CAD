import { apiClient } from './client';
import type { AdminUser, AuditPage, ReportsPayload, Role, SettingsPayload } from './types';

export const getReports = (shelterId?: string) => apiClient.get<ReportsPayload>('/dashboard/reports', { params: { shelterId } }).then((r) => r.data);

export const getAudit = (f: { entity?: string; userId?: string; action?: string; page?: number; pageSize?: number }) =>
  apiClient.get<AuditPage>('/audit', { params: f }).then((r) => r.data);
export const getAuditFacets = () => apiClient.get<{ entities: string[]; actions: string[] }>('/audit/facets').then((r) => r.data);

export const listUsers = () => apiClient.get<AdminUser[]>('/users').then((r) => r.data);
export const createUser = (data: { name: string; email: string; role: Role; phone?: string | null; skills?: string | null; languages?: string | null }) =>
  apiClient.post<AdminUser>('/users', data).then((r) => r.data);
export const updateUser = (id: string, data: Partial<{ name: string; email: string; role: Role; isActive: boolean; phone: string | null; skills: string | null; languages: string | null }>) =>
  apiClient.patch<AdminUser>(`/users/${id}`, data).then((r) => r.data);

export const getSettings = () => apiClient.get<SettingsPayload>('/settings').then((r) => r.data);
export const updateSettings = (data: Partial<SettingsPayload['settings']>) => apiClient.patch<SettingsPayload>('/settings', data).then((r) => r.data);
