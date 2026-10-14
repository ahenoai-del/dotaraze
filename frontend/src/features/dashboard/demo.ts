// Synthetic fixtures are reachable ONLY via the explicitly labelled demo mode.
import type { DashboardData, Hero, Match } from '../../types/player';

export const demoHeroes: Hero[] = [
  { id: 1, name: 'Anti-Mage', image: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png' },
  { id: 8, name: 'Juggernaut', image: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/juggernaut.png' },
  { id: 44, name: 'Phantom Assassin', image: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/phantom_assassin.png' },
  { id: 10, name: 'Morphling', image: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/morphling.png' },
];
const ids = [44, 8, 1, 10, 44, 8, 44, 1, 8, 10, 44, 8, 1, 44, 10, 8, 1, 44, 8, 10];
const demoMatches: Match[] = ids.map((hero_id, i) => ({
  match_id: 9000000000 + i, hero_id, start_time: 1789500000 - i * 61000,
  duration: 1920 + (i * 137) % 1500, won: i % 5 < 3,
  kills: 5 + i % 13, deaths: 2 + i % 7, assists: 6 + i % 12,
  gold_per_min: 450 + (i * 23) % 260, xp_per_min: 530 + (i * 31) % 300, lobby_type: 7,
}));
export const demoDashboard: DashboardData = {
  profile: { account_id: 0, name: 'Rise Player', avatar: null, rank_tier: null },
  summary: {
    matches: 20, decided_matches: 20, wins: 12, winrate: 60,
    kda: Number((demoMatches.reduce((a, m) => a + (m.kills! + m.assists!) / Math.max(1, m.deaths!), 0) / 20).toFixed(2)),
    gpm: demoMatches.reduce((a, m) => a + m.gold_per_min!, 0) / 20,
    xpm: demoMatches.reduce((a, m) => a + m.xp_per_min!, 0) / 20,
    kda_samples: 20, gpm_samples: 20, xpm_samples: 20,
  },
  heroes: demoHeroes.map(hero => {
    const rows = demoMatches.filter(m => m.hero_id === hero.id);
    const wins = rows.filter(m => m.won).length;
    return { hero_id: hero.id, games: rows.length, decided_matches: rows.length, wins, winrate: wins / rows.length * 100 };
  }).sort((a, b) => b.games - a.games),
  matches: demoMatches, source: 'Демонстрационные данные', fetched_at: '2026-09-15T12:00:00Z', sample_limit: 100, notice: null,
};
