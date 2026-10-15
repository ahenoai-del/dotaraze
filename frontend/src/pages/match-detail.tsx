import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, CircleAlert, RefreshCw, Swords } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import type { MatchItem, MatchPlayer } from '../types/match';
import type { Hero } from '../types/player';
import '../styles/match.css';

const fmt = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('ru-RU');
const gameModes: Record<number, string> = { 1: 'All Pick', 2: 'Captains Mode', 3: 'Random Draft', 4: 'Single Draft', 5: 'All Random', 16: 'Captains Draft', 18: 'Ability Draft', 22: 'All Draft', 23: 'Turbo' };
const lobbies: Record<number, string> = { 0: 'Обычный', 1: 'Тренировка', 2: 'Турнир', 4: 'Совместная игра с ботами', 7: 'Рейтинговый', 9: 'Боевой кубок' };
const label = (id: number | null, catalog: Record<number, string>) => id == null ? 'Неизвестно' : catalog[id] || `Неизвестный режим #${id}`;

function Item({ id, catalog }: { id: number | null; catalog: MatchItem[] }) {
  const item = catalog.find(row => row.id === id);
  const [failed, setFailed] = useState(false);
  const name = id == null ? 'Предмет неизвестен' : id === 0 ? 'Пустой слот' : item?.name || `Предмет #${id}`;
  return <span className={`match-item ${id === 0 ? 'empty' : ''}`} title={name} aria-label={name}>
    {item?.image && !failed ? <img src={item.image} alt={name} loading="lazy" onError={() => setFailed(true)}/> : <span>{id === 0 ? '·' : id == null ? '?' : `#${id}`}</span>}
  </span>;
}

function PlayerRow({ player, heroes, items, selected }: { player: MatchPlayer; heroes: Hero[]; items: MatchItem[]; selected: boolean }) {
  const hero = heroes.find(row => row.id === player.hero_id);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return <tr className={selected ? 'selected-player' : ''} aria-label={selected ? 'Выбранный игрок' : undefined}>
    <td><div className="match-hero"><div className="match-image">{hero && failedImage !== hero.image ? <img src={hero.image} alt="" onError={() => setFailedImage(hero.image)}/> : <Swords size={18}/>}</div><div><strong>{hero?.name || (player.hero_id ? `Герой #${player.hero_id}` : 'Герой неизвестен')}</strong><small>{player.name || (player.account_id ? `Игрок ${player.account_id}` : 'Анонимный игрок')}{selected && ' · выбранный игрок'}</small></div></div></td>
    <td>{fmt(player.kills)} / {fmt(player.deaths)} / {fmt(player.assists)}</td><td>{fmt(player.gold_per_min)} / {fmt(player.xp_per_min)}</td>
    <td>{fmt(player.hero_damage)}</td><td>{fmt(player.tower_damage)}</td><td>{fmt(player.hero_healing)}</td>
    <td><div className="match-inventory" aria-label="Основные предметы">{player.items.map((id, index) => <Item key={`${index}:${id}`} id={id} catalog={items}/>)}</div><div className="match-inventory backpack" aria-label="Рюкзак и нейтральный предмет">{player.backpack.map((id, index) => <Item key={`${index}:${id}`} id={id} catalog={items}/>)}<span className="neutral-label">N</span><Item key={player.neutral_item} id={player.neutral_item} catalog={items}/></div></td>
  </tr>;
}

export function MatchDetailPage() {
  const { matchId = '' } = useParams();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const valid = /^[0-9]{1,16}$/.test(matchId) && BigInt(matchId) > 0n && BigInt(matchId) <= 9007199254740991n;
  const query = useQuery({ queryKey: ['match', matchId], queryFn: ({ signal }) => api.match(matchId, signal), enabled: valid && !demo, staleTime: 120_000, retry: false });
  const heroes = useQuery({ queryKey: ['heroes', false], queryFn: ({ signal }) => api.heroes(signal), enabled: !!query.data, staleTime: 3_600_000, retry: false });
  const items = useQuery({ queryKey: ['match-items'], queryFn: ({ signal }) => api.items(signal), enabled: !!query.data, staleTime: 3_600_000, retry: false });
  const [metric, setMetric] = useState<'gold' | 'xp'>('gold');
  const from = params.get('from') || '';
  const back = /^\/dashboard(?:\?|#|$)/.test(from) && !/[\\\r\n]/.test(from) ? from : demo ? '/dashboard?demo=1' : '/dashboard';
  const selected = params.get('player');
  const data = query.data;
  const points = data?.advantage || [];
  return <><header className="topbar"><div className="breadcrumb">Твоё пространство <span>/</span><strong>Детали матча</strong></div><span className="early-access">MATCH DETAILS</span></header><main className="page-content match-detail-page">
    <Link className="back-link" to={back}><ArrowLeft size={16}/>Вернуться к истории</Link>
    <div className="page-title"><div><div className="eyebrow">ОТ МАТЧА К ПОНИМАНИЮ</div><h1>Матч <span>#{matchId.slice(0, 20)}</span></h1><p>Доступная статистика OpenDota. Без предположений о причинах результата.</p></div>{data && !demo && <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw size={15}/>Обновить</Button>}</div>
    {demo ? <section className="error-state" role="status"><h2>Детали недоступны в демо-режиме</h2><p>Демо содержит вымышленные ID. Они не отправляются в OpenDota.</p></section> : !valid ? <section className="error-state" role="alert"><CircleAlert/><h2>Некорректный ID матча</h2><p>Нужен положительный числовой ID.</p></section> : query.isLoading ? <div className="dashboard-skeleton" role="status" aria-label="Загрузка матча"><div className="skeleton h-32"/><div className="skeleton h-80"/></div> : query.isError ? <section className="error-state" role="alert"><CircleAlert/><h2>Не удалось загрузить матч</h2><p>{query.error.message}</p><Button onClick={() => query.refetch()}>Повторить</Button></section> : data && <>
      <section className="panel match-overview"><div className={`match-winner ${data.radiant_win === null ? '' : data.radiant_win ? 'radiant' : 'dire'}`}><Swords size={28}/><h2>{data.radiant_win === null ? 'Результат неизвестен' : `Победа ${data.radiant_win ? 'Radiant' : 'Dire'}`}</h2><strong>{fmt(data.radiant_score)} <span>:</span> {fmt(data.dire_score)}</strong><small>Счёт из источника</small></div><dl><div><dt>Длительность</dt><dd>{data.duration == null ? '—' : `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}`}</dd></div><div><dt>Начало матча</dt><dd>{data.start_time == null ? '—' : new Date(data.start_time * 1000).toLocaleString('ru-RU')}</dd></div><div><dt>Режим</dt><dd>{label(data.game_mode, gameModes)}</dd></div><div><dt>Лобби</dt><dd>{label(data.lobby_type, lobbies)}</dd></div></dl><a className="panel-link" href={data.source_url} target="_blank" rel="noreferrer">Матч в OpenDota <ArrowUpRight size={14}/></a></section>
      <div className="small-notice">{data.parsed ? 'Источник сообщает о разборе матча. Отдельные показатели всё равно могут отсутствовать.' : 'Матч не разобран: показана доступная базовая статистика.'} «—» означает неизвестное значение; 0 — опубликованный ноль. Предметы показывают состояние, возвращённое источником.</div>
      {data.notices.map(notice => <div className="small-notice" key={notice}>{notice}</div>)}
      {(heroes.isError || items.isError) && <div className="small-notice">Часть справочников недоступна: вместо названий показаны ID. <button onClick={() => { if (heroes.isError) heroes.refetch(); if (items.isError) items.refetch(); }}>Повторить справочники</button></div>}
      {(['radiant', 'dire'] as const).map(side => <section className={`panel match-team ${side}`} key={side}><div className="panel-heading"><div><h2>{side === 'radiant' ? 'Radiant' : 'Dire'} <span className="subtle-pill">{data.players.filter(p => p.side === side).length} / 5</span></h2><p>{data.radiant_win == null ? 'Результат неизвестен' : (side === 'radiant') === data.radiant_win ? 'Победившая сторона' : 'Проигравшая сторона'}</p></div></div><div className="table-scroll"><table><thead><tr><th>ГЕРОЙ / ИГРОК</th><th>K / D / A</th><th>GPM / XPM</th><th>УРОН ГЕРОЯМ</th><th>УРОН БАШНЯМ</th><th>ЛЕЧЕНИЕ</th><th>ПРЕДМЕТЫ</th></tr></thead><tbody>{data.players.filter(p => p.side === side).map(player => <PlayerRow key={player.player_slot} player={player} heroes={heroes.data || []} items={items.data || []} selected={player.account_id != null && String(player.account_id) === selected}/>)}</tbody></table></div>{!data.players.some(p => p.side === side) && <div className="table-empty">Источник не вернул игроков этой стороны.</div>}</section>)}
      <section className="panel match-advantage"><div className="panel-heading"><div><h2>Преимущество по ходу матча</h2><p>Положительное значение — в пользу Radiant, отрицательное — Dire</p></div><select aria-label="Показатель преимущества" value={metric} onChange={event => setMetric(event.target.value as 'gold' | 'xp')}><option value="gold">Золото</option><option value="xp">Опыт</option></select></div>{points.some(point => point[metric] != null) ? <div className="chart" role="img" aria-label="График преимущества Radiant"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ left: 8, right: 20, top: 15, bottom: 10 }}><CartesianGrid stroke="#ffffff09"/><XAxis dataKey="seconds" type="number" tickFormatter={value => `${Math.floor(value / 60)}м`} tick={{ fill: '#999', fontSize: 10 }}/><YAxis tick={{ fill: '#999', fontSize: 10 }}/><ReferenceLine y={0} stroke="#888"/><Tooltip labelFormatter={value => `${Math.floor(Number(value) / 60)} мин`} formatter={value => [fmt(Number(value)), metric === 'gold' ? 'Золото' : 'Опыт']} contentStyle={{ background: '#211c2c', border: '1px solid #534064', color: '#eee' }}/><Line dataKey={metric} stroke="#b28aff" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div> : <div className="chart-empty">Источник не предоставил временной ряд. График не строится.</div>}</section>
      <div className="data-note">{data.source} · Получено {new Date(data.fetched_at).toLocaleString('ru-RU')} · Кэш до 2 минут. Отсутствующие данные не восстанавливаются. GPM/XPM и урон — значения источника.</div>
    </>}
  </main></>;
}
