import { apiClient } from './client';
import type {
  PublicShelter, PublicShelterDetail, PublicStats, ShelterInput, ShelterOverview, ShelterStatus, ShelterTranslation,
  StaffShelter, ResourceType,
} from './types';

export interface ShelterFilters {
  q?: string;
  minAvailable?: number;
  resource?: ResourceType;
  status?: ShelterStatus;
}

export const listShelters = (f: ShelterFilters = {}) =>
  apiClient.get<PublicShelter[]>('/shelters', { params: f }).then((r) => r.data);

export const nearestShelters = (latitude: number, longitude: number, onlyAvailable = false) =>
  apiClient.get<PublicShelter[]>('/shelters/nearest', { params: { latitude, longitude, onlyAvailable } }).then((r) => r.data);

export const getPublicShelter = (id: string, lang?: string) =>
  apiClient.get<PublicShelterDetail>(`/shelters/${id}`, { params: { lang } }).then((r) => r.data);

export const getPublicStats = () => apiClient.get<PublicStats>('/shelters/stats/public').then((r) => r.data);

export const listManagedShelters = () => apiClient.get<StaffShelter[]>('/shelters/managed').then((r) => r.data);
export const getStaffShelter = (id: string) => apiClient.get<StaffShelter>(`/shelters/${id}/staff`).then((r) => r.data);
export const getShelterOverview = (id: string) => apiClient.get<ShelterOverview>(`/shelters/${id}/overview`).then((r) => r.data);

export const createShelter = (data: ShelterInput) => apiClient.post<StaffShelter>('/shelters', data).then((r) => r.data);
export const updateShelter = (id: string, data: Partial<ShelterInput>) =>
  apiClient.patch<StaffShelter>(`/shelters/${id}`, data).then((r) => r.data);
export const setShelterStatus = (id: string, status: ShelterStatus, reason?: string) =>
  apiClient.patch<StaffShelter>(`/shelters/${id}/status`, { status, reason }).then((r) => r.data);
export const saveTranslation = (id: string, locale: string, data: Partial<Pick<ShelterTranslation, 'name' | 'description' | 'instructions'>>) =>
  apiClient.put<ShelterTranslation>(`/shelters/${id}/translations/${locale}`, data).then((r) => r.data);
