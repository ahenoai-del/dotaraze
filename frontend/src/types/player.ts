export interface Match {
  match_id: number; hero_id: number; start_time: number; duration: number;
  won: boolean | null; kills: number | null; deaths: number | null; assists: number | null;
  gold_per_min: number | null; xp_per_min: number | null; lobby_type: number | null;
}
export interface Profile { account_id: number; name: string; avatar: string | null; rank_tier: number | null }
export interface Summary {
  matches: number; decided_matches: number; wins: number; winrate: number | null;
  kda: number | null; gpm: number | null; xpm: number | null;
  kda_samples: number; gpm_samples: number; xpm_samples: number;
}
export interface HeroSummary { hero_id: number; games: number; wins: number; decided_matches: number; winrate: number | null }
export interface DashboardData {
  profile: Profile; summary: Summary; heroes: HeroSummary[]; matches: Match[];
  source: string; fetched_at: string; sample_limit: number; notice: string | null;
}
export interface Hero { id: number; name: string; image: string }
export interface Session { steam_id: string; account_id: number; plan: 'free' }
