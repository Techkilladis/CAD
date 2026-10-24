import { apiClient } from './client';
import type { Transfer, TransferInput, TransferStatus } from './types';

export const listTransfers = (f: { status?: TransferStatus; shelterId?: string; direction?: 'incoming' | 'outgoing' } = {}) =>
  apiClient.get<Transfer[]>('/transfers', { params: f }).then((r) => r.data);
export const createTransfer = (data: TransferInput) => apiClient.post<Transfer>('/transfers', data).then((r) => r.data);
export const approveTransfer = (id: string) => apiClient.patch<Transfer>(`/transfers/${id}/approve`, {}).then((r) => r.data);
export const rejectTransfer = (id: string, reason?: string) => apiClient.patch<Transfer>(`/transfers/${id}/reject`, { reason }).then((r) => r.data);
export const dispatchTransfer = (id: string) => apiClient.patch<Transfer>(`/transfers/${id}/transit`, {}).then((r) => r.data);
export const receiveTransfer = (id: string) => apiClient.patch<Transfer>(`/transfers/${id}/received`, {}).then((r) => r.data);
export const cancelTransfer = (id: string, reason?: string) => apiClient.patch<Transfer>(`/transfers/${id}/cancel`, { reason }).then((r) => r.data);
