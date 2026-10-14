import type { DashboardData, Hero, Session } from '../types/player';
import type { MetaMode, MetaSnapshot, PatchCatalog } from '../types/meta';

export const API_URL = import.meta.env.VITE_API_URL || '/api';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { credentials: 'include', ...options });
  } catch {
    throw new ApiError(0, 'Не удалось связаться с сервером. Проверьте соединение и повторите запрос.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error?.message || 'Не удалось загрузить данные. Попробуйте позже.');
  }
  return response.status === 204 ? undefined as T : response.json();
}
export const api = {
  dashboard: (id: string, signal?: AbortSignal) => request<DashboardData>(`/players/${encodeURIComponent(id)}/dashboard`, { signal }),
  heroes: (signal?: AbortSignal) => request<Hero[]>('/heroes', { signal }),
  me: () => request<Session>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  deleteAccount: () => request<void>('/auth/account', { method: 'DELETE' }),
  meta: (mode: MetaMode, bracket: string, signal?: AbortSignal) => request<MetaSnapshot>(`/meta/heroes?${new URLSearchParams({ mode, bracket })}`, { signal }),
  patches: (signal?: AbortSignal) => request<PatchCatalog>('/meta/patches', { signal }),
};
