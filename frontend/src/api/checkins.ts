import { apiClient } from './client';
import type { Checkin, CheckinStatus, MedicalPriority, OccupantInput, RegistrationReceipt } from './types';

export const registerFamily = (shelterId: string, data: OccupantInput) =>
  apiClient.post<RegistrationReceipt>(`/shelters/${shelterId}/register`, data).then((r) => r.data);

export const checkInFamily = (shelterId: string, data: OccupantInput) =>
  apiClient.post<Checkin | { duplicate: true; checkin: Checkin }>(`/shelters/${shelterId}/checkin`, data).then((r) => r.data);

export const listCheckins = (shelterId: string, f: { status?: CheckinStatus; priority?: MedicalPriority; q?: string } = {}) =>
  apiClient.get<Checkin[]>(`/shelters/${shelterId}/checkins`, { params: f }).then((r) => r.data);

export const confirmCheckin = (shelterId: string, checkinId: string) =>
  apiClient.patch<Checkin>(`/shelters/${shelterId}/checkin/${checkinId}/confirm`).then((r) => r.data);

export const rejectCheckin = (shelterId: string, checkinId: string, reason?: string) =>
  apiClient.patch<Checkin>(`/shelters/${shelterId}/checkin/${checkinId}/reject`, { reason }).then((r) => r.data);

export const checkOutFamily = (shelterId: string, checkinId: string) =>
  apiClient.post<Checkin>(`/shelters/${shelterId}/checkout`, { checkinId }).then((r) => r.data);
