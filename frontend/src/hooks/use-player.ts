import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DashboardData } from '../types/player';
import { demoDashboard, demoHeroes } from '../features/dashboard/demo';

export function usePlayer(id: string | null, demo: boolean) {
  return useQuery<DashboardData>({
    queryKey: ['player', demo ? 'demo' : id],
    queryFn: ({ signal }) => demo ? Promise.resolve(demoDashboard) : api.dashboard(id!, signal),
    enabled: demo || !!id,
    staleTime: 120_000,
    retry: false,
  });
}
export function useHeroes(demo: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['heroes', demo],
    queryFn: ({ signal }) => demo ? Promise.resolve(demoHeroes) : api.heroes(signal),
    enabled,
    staleTime: 3_600_000,
    retry: false,
  });
}
