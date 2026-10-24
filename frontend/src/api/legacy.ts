// Endpoints used by pages that are rewritten in later phases (volunteers, reunification).
// Each function here disappears when its page moves to a typed domain module.
import { apiClient } from './client';

export const getShifts = (shelterId?: string) => apiClient.get(`/volunteers${shelterId ? `?shelterId=${shelterId}` : ''}`);
export const signUpForShift = (id: string) => apiClient.post(`/volunteers/${id}/signup`);
export const cancelSignup = (id: string) => apiClient.delete(`/volunteers/${id}/signup`);
export const reportMissingPerson = (data: any) => apiClient.post('/reunification', data);
