import { apiClient } from './client';
import type { PublicResource, Resource, ResourceType, ResourceUpdate, StockMovement } from './types';

export const listResources = (shelterId: string) =>
  apiClient.get<Resource[] | PublicResource[]>(`/shelters/${shelterId}/resources`).then((r) => r.data);

export const createResource = (shelterId: string, data: { resourceType: ResourceType; quantity: number; unit: string; lowStockThreshold?: number; note?: string }) =>
  apiClient.post<Resource>(`/shelters/${shelterId}/resources`, data).then((r) => r.data);

export const updateResource = (shelterId: string, resourceId: string, data: ResourceUpdate) =>
  apiClient.patch<Resource>(`/shelters/${shelterId}/resources/${resourceId}`, data).then((r) => r.data);

export const getMovements = (shelterId: string, resourceId?: string) =>
  apiClient.get<StockMovement[]>(`/shelters/${shelterId}/resources/movements`, { params: { resourceId } }).then((r) => r.data);
