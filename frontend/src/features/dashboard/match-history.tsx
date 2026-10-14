import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, Filter, Search, Swords } from 'lucide-react';
import type { Hero, Match } from '../../types/player';
import { Button } from '../../components/ui/button';
import { format } from './metrics';

export function MatchHistory({ matches, heroes, demo }: { matches: Match[]; heroes: Hero[]; demo: boolean }) {
  const [result, setResult] = useState('all');
  const [heroId, setHeroId] = useState('all');
  const [mode, setMode] = useState('all');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => matches.filter(m =>
    (result === 'all' || m.won === (result === 'win')) &&
    (heroId === 'all' || m.hero_id === Number(heroId)) &&
    (mode === 'all' || (mode === 'ranked' ? m.lobby_type === 7 : m.lobby_type !== 7)) &&
    (period === 'all' || m.start_time * 1000 >= Date.now() - Number(period) * 86400000)
  ).sort((a, b) => b.start_time - a.start_time), [matches, result, heroId, mode, period]);
  useEffect(() => setPage(0), [result, heroId, mode, period, matches]);
  const available = [...new Set(matches.map(m => m.hero_id))];
  return <section className="panel match-panel" id="match-history"><div className="panel-heading"><div><h2>История матчей <span className="subtle-pill">{matches.length}</span></h2><p>Разбери прошлые игры. Подготовься к следующим.</p></div><span className="source-label"><span className="status-dot"/>{demo ? 'DEMO' : 'OpenDota'}</span></div>
    <div className="match-filters"><span className="filter-label"><Filter size={15}/>Фильтры</span><select aria-label="Герой" value={heroId} onChange={e => setHeroId(e.target.value)}><option value="all">Все герои</option>{available.map(id => <option value={id} key={id}>{heroes.find(h => h.id === id)?.name || `Герой #${id}`}</option>)}</select><select aria-label="Результат" value={result} onChange={e => setResult(e.target.value)}><option value="all">Все результаты</option><option value="win">Победы</option><option value="loss">Поражения</option></select><select aria-label="Режим" value={mode} onChange={e => setMode(e.target.value)}><option value="all">Все режимы</option><option value="ranked">Рейтинговые</option><option value="other">Остальные</option></select><select aria-label="Период" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">Вся выборка</option><option value="7">7 дней</option><option value="30">30 дней</option></select>{(result !== 'all' || heroId !== 'all' || mode !== 'all' || period !== 'all') && <Button size="sm" variant="ghost" onClick={() => { setResult('all'); setHeroId('all'); setMode('all'); setPeriod('all'); }}>Сбросить</Button>}</div>
    <div className="table-scroll"><table><thead><tr><th>ГЕРОЙ</th><th>РЕЗУЛЬТАТ</th><th>K / D / A</th><th>GPM / XPM</th><th>ДЛИТЕЛЬНОСТЬ</th><th><span className="inline-flex items-center gap-1">ДАТА <ArrowDown size={12}/></span></th><th><span className="sr-only">Ссылка на матч</span></th></tr></thead><tbody>{filtered.slice(page * 8, page * 8 + 8).map(m => {
      const hero = heroes.find(h => h.id === m.hero_id);
      return <tr key={m.match_id}><td><div className="match-hero"><div className="match-image">{hero ? <img src={hero.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }}/> : <Swords size={18}/>}</div><div><strong>{hero?.name || `Герой #${m.hero_id}`}</strong><small>{m.lobby_type === 7 ? 'Рейтинговый' : m.lobby_type == null ? 'Режим неизвестен' : 'Другой режим'}</small></div></div></td><td><span className={`result ${m.won == null ? 'unknown' : m.won ? 'win' : 'loss'}`}><i/>{m.won == null ? 'Неизвестно' : m.won ? 'Победа' : 'Поражение'}</span></td><td><span className="kda">{format(m.kills)} <em>/</em> {format(m.deaths)} <em>/</em> {format(m.assists)}</span></td><td><span className="text-zinc-300">{format(m.gold_per_min)}</span><span className="text-zinc-600"> / </span>{format(m.xp_per_min)}</td><td>{Math.floor(m.duration / 60)}:{String(m.duration % 60).padStart(2, '0')}</td><td>{new Date(m.start_time * 1000).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</td><td>{!demo && <a aria-label={`Матч ${m.match_id} в OpenDota`} href={`https://www.opendota.com/matches/${m.match_id}`} target="_blank" rel="noreferrer"><ArrowUpRight size={17}/></a>}</td></tr>;
    })}</tbody></table></div>
    {!filtered.length && <div className="table-empty"><Search size={28}/><h3>Матчей не найдено</h3><p>Измените фильтры или дождитесь новых публичных матчей.</p></div>}
    <div className="table-footer"><span>{filtered.length ? `${page * 8 + 1}–${Math.min(page * 8 + 8, filtered.length)} из ${filtered.length} матчей` : '0 матчей'}<small>Фильтры действуют внутри загруженной выборки</small></span><div><Button variant="outline" size="icon" aria-label="Предыдущая страница" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16}/></Button><span>{page + 1} / {Math.max(1, Math.ceil(filtered.length / 8))}</span><Button variant="outline" size="icon" aria-label="Следующая страница" disabled={(page + 1) * 8 >= filtered.length} onClick={() => setPage(page + 1)}><ChevronRight size={16}/></Button></div></div>
  </section>;
}
