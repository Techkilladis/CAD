import { apiClient } from './client';
import type { Donation, DonationInput, DonationStatus, ResourceType } from './types';

export const listDonations = (f: { shelterId?: string; resourceType?: ResourceType; status?: DonationStatus; from?: string; to?: string } = {}) =>
  apiClient.get<Donation[]>('/donations', { params: f }).then((r) => r.data);
export const createDonation = (data: DonationInput) => apiClient.post<Donation>('/donations', data).then((r) => r.data);
export const updateDonation = (id: string, data: { notes?: string | null; receiptRef?: string | null; receiptFileName?: string | null; status?: 'ACCEPTED' | 'REJECTED' }) =>
  apiClient.patch<Donation>(`/donations/${id}`, data).then((r) => r.data);
