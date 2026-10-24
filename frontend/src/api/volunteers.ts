import { apiClient } from './client';
import type { Shift, ShiftInput, VolunteerUser } from './types';

export const listShifts = (f: { shelterId?: string; upcoming?: boolean } = {}) =>
  apiClient.get<Shift[]>('/volunteers/shifts', { params: f }).then((r) => r.data);
export const myShifts = () => apiClient.get<Shift[]>('/volunteers/me/shifts').then((r) => r.data);
export const listVolunteers = () => apiClient.get<VolunteerUser[]>('/volunteers').then((r) => r.data);
export const createShift = (data: ShiftInput) => apiClient.post<Shift>('/volunteers/shifts', data).then((r) => r.data);
export const updateShift = (id: string, data: Partial<Omit<ShiftInput, 'shelterId'>> & { status?: 'OPEN' | 'CANCELLED' }) =>
  apiClient.patch<Shift>(`/volunteers/shifts/${id}`, data).then((r) => r.data);
export const signUpForShift = (id: string) => apiClient.post(`/volunteers/shifts/${id}/signup`).then((r) => r.data);
export const cancelSignup = (id: string) => apiClient.delete(`/volunteers/shifts/${id}/signup`).then((r) => r.data);
export const removeVolunteer = (shiftId: string, volunteerId: string) =>
  apiClient.delete(`/volunteers/shifts/${shiftId}/volunteers/${volunteerId}`).then((r) => r.data);
