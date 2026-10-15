import type { DashboardData, Hero, Session } from '../types/player';
import type { MetaMode, MetaSnapshot, PatchCatalog } from '../types/meta';
import type { MatchDetail, MatchItem } from '../types/match';

export const API_URL = import.meta.env.VITE_API_URL || '/api';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { credentials: 'include', ...options });
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    throw new ApiError(0, 'Не удалось связаться с сервером. Проверьте соединение и повторите запрос.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof body?.error?.message === 'string' ? body.error.message : 'Не удалось загрузить данные. Попробуйте позже.');
  }
  if (response.status === 204) return undefined as T;
  try {
    const body = await response.json();
    if (body == null) throw new Error('Empty JSON');
    return body as T;
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    throw new ApiError(response.status, 'Сервер вернул некорректный ответ. Повторите запрос позже.');
  }
}
export const api = {
  match: (id: string, signal?: AbortSignal) => request<MatchDetail>(`/matches/${encodeURIComponent(id)}`, { signal }),
  items: (signal?: AbortSignal) => request<MatchItem[]>('/match-items', { signal }),
  dashboard: (id: string, signal?: AbortSignal) => request<DashboardData>(`/players/${encodeURIComponent(id)}/dashboard`, { signal }),
  heroes: (signal?: AbortSignal) => request<Hero[]>('/heroes', { signal }),
  me: () => request<Session>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  deleteAccount: () => request<void>('/auth/account', { method: 'DELETE' }),
  meta: (mode: MetaMode, bracket: string, signal?: AbortSignal) => request<MetaSnapshot>(`/meta/heroes?${new URLSearchParams({ mode, bracket })}`, { signal }),
  patches: (signal?: AbortSignal) => request<PatchCatalog>('/meta/patches', { signal }),
};
