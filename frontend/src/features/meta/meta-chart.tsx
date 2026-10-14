import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { MetaHero } from '../../types/meta';
import { percent } from './helpers';

export function MetaChart({ heroes, onSelect }: { heroes: MetaHero[]; onSelect: (id: number) => void }) {
  const points = heroes.filter(hero => hero.pickrate != null && hero.winrate != null);
  const lower = points.length ? Math.max(0, Math.floor(Math.min(...points.map(hero => hero.winrate!)) - 3)) : 0;
  const upper = points.length ? Math.min(100, Math.ceil(Math.max(...points.map(hero => hero.winrate!)) + 3)) : 100;
  return <section className="panel meta-chart-panel"><div className="panel-heading"><div><h2>Карта меты <span className="subtle-pill">{points.length} героев</span></h2><p>Популярность и результативность в выбранном срезе</p></div><span className="meta-live-dot"><i/>Интерактивно</span></div>
    {points.length ? <div className="meta-scatter" role="img" aria-label="График Pickrate и Winrate героев"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 20, right: 24, bottom: 20, left: 0 }}><CartesianGrid stroke="#ffffff09" strokeDasharray="3 5"/><XAxis dataKey="pickrate" type="number" name="Pickrate · оценка" unit="%" tick={{ fill: '#867a99', fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis dataKey="winrate" type="number" name="Winrate" unit="%" domain={[lower, upper]} tick={{ fill: '#867a99', fontSize: 10 }} axisLine={false} tickLine={false}/><ReferenceLine y={50} stroke="#84cdb13d" strokeDasharray="4 4"/><Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
      const hero = payload?.[0]?.payload as MetaHero | undefined;
      return active && hero ? <div className="meta-tooltip"><strong>{hero.name}</strong><span>Winrate {percent(hero.winrate)}</span><span>Pickrate* {percent(hero.pickrate)}</span></div> : null;
    }}/><Scatter data={points} fill="#b28aff" fillOpacity={0.65} isAnimationActive={false} cursor="pointer" onClick={point => { const hero = (point as { payload?: MetaHero }).payload; if (hero) onSelect(hero.id); }}/></ScatterChart></ResponsiveContainer></div> : <div className="chart-empty">В этом срезе недостаточно данных для графика</div>}
    <p className="chart-footnote">X: Pickrate* · Y: Winrate. Нажмите на точку для деталей. Состав точек зависит от фильтров, знаменатель Pickrate — нет.</p>
  </section>;
}
