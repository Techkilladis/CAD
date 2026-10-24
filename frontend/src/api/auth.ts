import { apiClient } from './client';
import type { DemoUser, Me } from './types';

export const getDemoUsers = () => apiClient.get<DemoUser[]>('/auth/users').then((r) => r.data);
export const getMe = () => apiClient.get<Me>('/auth/me').then((r) => r.data);
export const updateMe = (data: { name?: string; phone?: string | null; skills?: string | null; languages?: string | null }) =>
  apiClient.patch<Me>('/auth/me', data).then((r) => r.data);
