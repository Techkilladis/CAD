import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Demo auth: the selected local user is sent as x-user-id (replaced by a Cognito JWT on AWS).
apiClient.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  if (userId) config.headers['x-user-id'] = userId;
  return config;
});

/** True when the request never reached the server (offline / backend down). */
export const isNetworkError = (err: unknown): boolean =>
  axios.isAxiosError(err) && !err.response;

/** Human-readable message for toasts. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Cannot reach the server. Check your connection and try again.';
    const data = err.response.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    return `${fallback} (HTTP ${err.response.status})`;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/** Field-level errors from a 400 validation response: { fieldName: message }. */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {};
  const details = (err.response?.data as { details?: { path: string; message: string }[] } | undefined)?.details;
  if (!Array.isArray(details)) return {};
  const out: Record<string, string> = {};
  for (const d of details) if (d.path && !out[d.path]) out[d.path] = d.message;
  return out;
}
