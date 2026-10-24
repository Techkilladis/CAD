import { apiClient } from './client';
import type { Alert, AlertCheckResult, AlertStatus, AlertType } from './types';

export const listAlerts = (f: { status?: AlertStatus; type?: AlertType; shelterId?: string } = {}) =>
  apiClient.get<Alert[]>('/alerts', { params: f }).then((r) => r.data);
export const runAlertCheck = () => apiClient.post<AlertCheckResult>('/alerts/run-check').then((r) => r.data);
export const acknowledgeAlert = (id: string) => apiClient.patch<Alert>(`/alerts/${id}/acknowledge`).then((r) => r.data);
export const resolveAlert = (id: string) => apiClient.patch<Alert>(`/alerts/${id}/resolve`).then((r) => r.data);
