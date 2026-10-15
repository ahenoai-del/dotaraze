export interface MatchPlayer {
  player_slot: number; side: 'radiant' | 'dire'; account_id: number | null; name: string | null;
  hero_id: number | null; kills: number | null; deaths: number | null; assists: number | null;
  gold_per_min: number | null; xp_per_min: number | null; hero_damage: number | null;
  tower_damage: number | null; hero_healing: number | null;
  items: (number | null)[]; backpack: (number | null)[]; neutral_item: number | null;
}
export interface MatchDetail {
  match_id: number; start_time: number | null; duration: number | null; radiant_win: boolean | null;
  radiant_score: number | null; dire_score: number | null; game_mode: number | null; lobby_type: number | null;
  parsed: boolean; players: MatchPlayer[]; advantage: { seconds: number; gold: number | null; xp: number | null }[];
  notices: string[]; fetched_at: string; source: string; source_url: string;
}
export interface MatchItem { id: number; name: string; image: string | null }
