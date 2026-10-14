import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartNoAxesCombined } from 'lucide-react';
import type { Match } from '../../types/player';
import { format } from './metrics';

export function ProgressChart({ matches }: { matches: Match[] }) {
  const [metric, setMetric] = useState<'gold_per_min' | 'xp_per_min' | 'kda'>('gold_per_min');
  const data = useMemo(() => [...matches].sort((a, b) => a.start_time - b.start_time).map((m, index) => ({
    index: index + 1, date: new Date(m.start_time * 1000).toLocaleDateString('ru-RU'),
    value: metric === 'kda' ? (m.kills != null && m.assists != null && m.deaths != null ? Math.round((m.kills + m.assists) / Math.max(1, m.deaths) * 100) / 100 : null) : m[metric],
  })), [matches, metric]);
  const values = data.filter(d => d.value != null);
  const average = values.length ? values.reduce((a, d) => a + d.value!, 0) / values.length : null;
  return <section className="panel progress-panel"><div className="panel-heading"><div><h2>Динамика игры <span className="subtle-pill">{matches.length} матчей</span></h2><p>Каждый матч — шаг вперёд</p></div><select aria-label="Показатель графика" value={metric} onChange={e => setMetric(e.target.value as typeof metric)}><option value="gold_per_min">GPM</option><option value="xp_per_min">XPM</option><option value="kda">KDA</option></select></div>
    <div className="chart-caption"><strong>{format(average, metric === 'kda' ? 2 : 0)}</strong><span>средний {metric === 'gold_per_min' ? 'GPM' : metric === 'xp_per_min' ? 'XPM' : 'KDA'} по выборке</span><span className="chart-legend"><i/>От матча к матчу</span></div>
    {values.length ? <div className="chart" role="img" aria-label={`Динамика показателя по ${values.length} матчам`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 15, right: 12, left: -22, bottom: 0 }}><defs><linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a880ff" stopOpacity={0.25}/><stop offset="95%" stopColor="#a880ff" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#ffffff0a"/><XAxis dataKey="index" tickLine={false} axisLine={false} minTickGap={35} tick={{ fill: '#747580', fontSize: 11 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#747580', fontSize: 11 }}/><Tooltip contentStyle={{ background: '#22212e', border: '1px solid #3b354f', borderRadius: 10, color: '#eee' }} labelFormatter={(_, payload) => payload?.[0]?.payload.date || ''} formatter={value => [format(Number(value), 2), 'Показатель']}/><Area dataKey="value" type="linear" isAnimationActive={false} connectNulls={false} stroke="#aa83ff" strokeWidth={2.5} fill="url(#progressFill)" activeDot={{ r: 5, stroke: '#1b1727', strokeWidth: 3 }}/></AreaChart></ResponsiveContainer></div> : <div className="chart-empty"><ChartNoAxesCombined size={30}/><p>Для этого показателя пока нет данных</p></div>}
    <p className="chart-footnote">Матчи по времени: от ранних к последним. Пропуски данных не интерполируются.</p>
  </section>;
}
