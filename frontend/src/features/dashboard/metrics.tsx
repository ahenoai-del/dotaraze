import { Crosshair, Coins, TrendingUp, Zap } from 'lucide-react';
import type { Summary } from '../../types/player';

export const format = (value: number | null | undefined, digits = 0) => value == null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
export function Metrics({ summary }: { summary: Summary }) {
  const items = [
    { label: 'Винрейт', value: summary.winrate == null ? '—' : `${format(summary.winrate, 1)}%`, sub: `${summary.wins} побед · ${summary.decided_matches} матчей с результатом`, icon: TrendingUp, color: 'green' },
    { label: 'Средний KDA', value: format(summary.kda, 2), sub: `${summary.kda_samples} матчей с K / D / A`, icon: Crosshair, color: 'purple' },
    { label: 'Золото в минуту', value: format(summary.gpm), sub: `${summary.gpm_samples} матчей с GPM`, icon: Coins, color: 'gold' },
    { label: 'Опыт в минуту', value: format(summary.xpm), sub: `${summary.xpm_samples} матчей с XPM`, icon: Zap, color: 'blue' },
  ];
  return <div className="metrics-grid">{items.map(({ label, value, sub, icon: Icon, color }) => <article className="metric-card" key={label}><div className="metric-title">{label}<span className={`metric-icon ${color}`}><Icon size={17}/></span></div><strong>{value}</strong><p>{sub}</p></article>)}</div>;
}
