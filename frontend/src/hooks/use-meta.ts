import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MetaMode } from '../types/meta';

export function useMeta(mode: MetaMode, bracket: string) {
  return useQuery({ queryKey: ['meta', mode, bracket], queryFn: ({ signal }) => api.meta(mode, bracket, signal), staleTime: 120_000, retry: false });
}
export function usePatches() {
  return useQuery({ queryKey: ['patches'], queryFn: ({ signal }) => api.patches(signal), staleTime: 120_000, retry: false });
}
