import { apiClient } from './client';
import type { DistrictOccupancy, ResourceMatrix } from './types';

export const getDistrict = (shelterId?: string) =>
  apiClient.get<DistrictOccupancy>('/dashboard/district', { params: { shelterId } }).then((r) => r.data);

export const getResourceMatrix = (shelterId?: string) =>
  apiClient.get<ResourceMatrix>('/dashboard/resources', { params: { shelterId } }).then((r) => r.data);
