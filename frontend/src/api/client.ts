import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  if (userId) {
    config.headers['x-user-id'] = userId;
  }
  return config;
});

export const getShelters = () => apiClient.get('/shelters');
export const getNearestShelters = (lat: number, lon: number) => 
  apiClient.get(`/shelters/nearest?latitude=${lat}&longitude=${lon}`);
export const getShelterById = (id: string) => apiClient.get(`/shelters/${id}`);
export const getUsers = () => apiClient.get('/auth/users');

export const register = (id: string, data: any) => apiClient.post(`/shelters/${id}/register`, data);
export const checkIn = (id: string, data: any) => apiClient.post(`/shelters/${id}/checkin`, data);
export const confirmCheckin = (id: string, checkinId: string) => apiClient.patch(`/shelters/${id}/checkin/${checkinId}/confirm`);
export const checkOut = (id: string, data: any) => apiClient.post(`/shelters/${id}/checkout`, data);

export const updateResource = (shelterId: string, resourceId: string, quantity: number) => 
  apiClient.patch(`/shelters/${shelterId}/resources/${resourceId}`, { quantity });

export const getDashboardStats = () => apiClient.get('/dashboard');
export const getTransfers = () => apiClient.get('/transfers');
export const createTransfer = (data: any) => apiClient.post('/transfers', data);
export const approveTransfer = (id: string, data?: any) => apiClient.patch(`/transfers/${id}/approve`, data || {});
export const rejectTransfer = (id: string, data?: any) => apiClient.patch(`/transfers/${id}/reject`, data || {});
export const markInTransit = (id: string) => apiClient.patch(`/transfers/${id}/transit`);
export const receiveTransfer = (id: string) => apiClient.patch(`/transfers/${id}/receive`);

export const runAlertCheck = () => apiClient.post('/alerts/run-check');
export const acknowledgeAlert = (id: string) => apiClient.patch(`/alerts/${id}/acknowledge`);
export const resolveAlert = (id: string) => apiClient.patch(`/alerts/${id}/resolve`);

export const getShifts = (shelterId?: string) => apiClient.get(`/volunteers${shelterId ? `?shelterId=${shelterId}` : ''}`);
export const createShift = (data: any) => apiClient.post('/volunteers', data);
export const signUpForShift = (id: string) => apiClient.post(`/volunteers/${id}/signup`);
export const cancelSignup = (id: string) => apiClient.delete(`/volunteers/${id}/signup`);

export const reportMissingPerson = (data: any) => apiClient.post('/reunification', data);
export const getAllReunificationCases = () => apiClient.get('/reunification');
export const updateReunificationCaseStatus = (id: string, status: string) => apiClient.patch(`/reunification/${id}/status`, { status });
