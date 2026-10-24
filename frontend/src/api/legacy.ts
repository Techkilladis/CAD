// Endpoints used by pages that are rewritten in a later phase (reunification, phase D).
import { apiClient } from './client';

export const reportMissingPerson = (data: any) => apiClient.post('/reunification', data);
