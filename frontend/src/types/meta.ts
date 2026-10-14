export type MetaMode = 'pub' | 'pro' | 'turbo';
export interface MetaHero {
  id: number; name: string; image: string | null; primary_attr: string | null;
  attack_type: string | null; roles: string[]; picks: number | null; wins: number | null;
  winrate: number | null; pick_share: number | null; pickrate: number | null;
  confidence_low: number | null; confidence_high: number | null; bans: number | null;
}
export interface MetaSnapshot {
  mode: MetaMode; bracket: string; heroes: MetaHero[]; total_picks: number;
  distribution_complete: boolean; available_brackets: string[]; fetched_at: string;
  source: string; source_url: string; period: string; pickrate_method: string; notices: string[];
}
export interface PatchCatalog {
  patches: { id: number; name: string; date: string }[];
  fetched_at: string; source: string; notice: string;
}
