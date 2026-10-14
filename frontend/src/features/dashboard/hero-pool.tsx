import { ArrowUpRight, Swords } from 'lucide-react';
import type { Hero, HeroSummary } from '../../types/player';
import { format } from './metrics';

export function HeroPool({ stats, heroes }: { stats: HeroSummary[]; heroes: Hero[] }) {
  return <section className="panel heroes-panel"><div className="panel-heading"><div><h2>Твой пул героев</h2><p>Самые частые выборы в этой выборке</p></div><Swords size={19} className="text-zinc-500"/></div><div className="hero-list">
    {stats.slice(0, 4).map((stat, i) => {
      const hero = heroes.find(h => h.id === stat.hero_id);
      return <div className="hero-row" key={stat.hero_id}><span className="hero-position">0{i + 1}</span><div className="hero-portrait">{hero && <img src={hero.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }}/>}</div><div className="hero-details"><strong>{hero?.name || `Герой #${stat.hero_id}`}</strong><span>{stat.games} матчей · {stat.wins} побед</span><div className="hero-meter"><i style={{ width: `${stat.winrate || 0}%` }}/></div></div><div className="hero-winrate" title={`${stat.wins} побед / ${stat.decided_matches} матчей с известным результатом`}>{format(stat.winrate, 1)}{stat.winrate != null && '%'}<small>винрейт</small></div></div>;
    })}
    {!stats.length && <p className="empty-inline">Статистика появится после загрузки матчей.</p>}
  </div><a className="panel-link" href="#match-history">Перейти к истории матчей <ArrowUpRight size={15}/></a></section>;
}
