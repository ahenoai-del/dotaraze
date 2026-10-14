import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Check, CircleAlert, Clock3, ExternalLink, Gamepad2, LogIn, LogOut, RefreshCw, Search, ShieldCheck, Sparkles, Swords, Trash2, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useHeroes, usePlayer } from '../hooks/use-player';
import { API_URL, api, ApiError } from '../services/api';
import { Metrics } from '../features/dashboard/metrics';
import { ProgressChart } from '../features/dashboard/progress-chart';
import { HeroPool } from '../features/dashboard/hero-pool';
import { MatchHistory } from '../features/dashboard/match-history';
import { DeleteAccountDialog } from '../components/delete-account-dialog';
import { AuthNotice } from '../components/auth-notice';

function rankName(tier: number | null) {
  if (!tier) return 'Ранг не опубликован';
  const names = ['Без ранга', 'Рекрут', 'Страж', 'Рыцарь', 'Герой', 'Легенда', 'Властелин', 'Божество', 'Титан'];
  return `${names[Math.floor(tier / 10)] || 'Ранг'}${Math.floor(tier / 10) < 8 ? ` · ${tier % 10}` : ''}`;
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const demo = params.get('demo') === '1';
  const playerId = params.get('player');
  const [input, setInput] = useState(playerId || '');
  const [validation, setValidation] = useState('');
  useEffect(() => { setInput(playerId || ''); setValidation(''); }, [playerId, demo]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ['session'], queryFn: api.me, retry: false, staleTime: 60_000 });
  const id = playerId || (session.data ? String(session.data.account_id) : null);
  const player = usePlayer(id, demo);
  const heroes = useHeroes(demo, !!player.data);
  const logout = useMutation({ mutationFn: api.logout, onSuccess: () => { queryClient.setQueryData(['session'], null); queryClient.removeQueries({ queryKey: ['player'] }); setParams({}); } });
  const remove = useMutation({ mutationFn: api.deleteAccount, onSuccess: () => { queryClient.setQueryData(['session'], null); queryClient.removeQueries({ queryKey: ['player'] }); setConfirmDelete(false); setParams({}); } });
  function search(e: FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!/^[0-9]{1,17}$/.test(value)) { setValidation('Введите числовой Dota Friend ID или Steam ID64.'); return; }
    const numeric = BigInt(value);
    const normalized = numeric >= 76561197960265728n ? numeric - 76561197960265728n : numeric;
    if (normalized < 1n || normalized > 4294967295n) { setValidation('Этот ID находится вне допустимого диапазона.'); return; }
    setValidation('');
    setParams({ player: value });
  }
  const data = player.data;
  return <>
    <header className="topbar"><div className="breadcrumb">Твоё пространство <span>/</span><strong>Dashboard</strong></div><div className="topbar-right"><span className="early-access">EARLY ACCESS</span>{session.data ? <Button size="sm" variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={14}/>Выйти</Button> : <Button asChild size="sm" variant="outline"><a href={`${API_URL}/auth/steam/login`}><LogIn size={14}/>Войти через Steam</a></Button>}</div></header>
    <main className="page-content">
      <AuthNotice code={params.get('auth_error')} onDismiss={() => { const next = new URLSearchParams(params); next.delete('auth_error'); setParams(next, { replace: true }); }}/>
      <div className="page-title"><div><div className="eyebrow"><span/>ТВОЙ ПУТЬ К ПОБЕДЕ</div><h1>Dashboard<span>.</span></h1><p>Твоя игра в цифрах. Твой прогресс под контролем.</p></div>{data && <Button variant="outline" disabled={demo || player.isFetching} onClick={() => player.refetch()}><RefreshCw size={15} className={player.isFetching ? 'animate-spin' : ''}/>{player.isFetching ? 'Обновление…' : 'Обновить'}</Button>}</div>
      <form className="search-bar" onSubmit={search}><Search size={19}/><input aria-label="Steam ID или Dota Friend ID" placeholder="Steam ID64 или Dota Friend ID" value={input} onChange={e => setInput(e.target.value)} maxLength={32}/><span className="search-hint">Публичный профиль</span><Button type="submit" disabled={player.isFetching && !demo}>Найти игрока <ArrowRight size={16}/></Button></form>
      {validation && <p className="form-error" role="alert">{validation}</p>}
      {session.error && !(session.error instanceof ApiError && session.error.status === 401) && <div className="small-notice">Сервис входа сейчас недоступен. Поиск публичных профилей работает независимо от входа.</div>}
      {(logout.error || remove.error) && <div className="error-banner" role="alert">{(logout.error || remove.error)?.message}</div>}
      {demo && <div className="demo-banner"><Sparkles size={17}/><span><strong>Демо-режим</strong> · Вымышленные данные для знакомства с интерфейсом</span><Button size="sm" variant="ghost" onClick={() => setParams({})}><X size={15}/>Выйти из демо</Button></div>}
      {player.isLoading && <DashboardSkeleton/>}
      {player.isError && <div className="error-state" role="alert"><CircleAlert size={32}/><h2>Не удалось загрузить профиль</h2><p>{player.error.message}</p><div><Button onClick={() => player.refetch()}>Повторить</Button><Button variant="outline" onClick={() => setParams({ demo: '1' })}>Открыть демо</Button></div><small>В Dota 2 включите «Общедоступная история матчей». OpenDota может получить данные с задержкой.</small></div>}
      {!id && !demo && !session.isLoading && <Welcome onDemo={() => setParams({ demo: '1' })}/>}
      {session.isLoading && !id && !demo && <div className="small-notice">Проверяем сессию…</div>}
      {data && !player.isError && <>
        <section className="profile-card"><div className="profile-identity"><div className="avatar">{data.profile.avatar && !demo ? <img src={data.profile.avatar} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }}/> : <Gamepad2 size={32}/>}<span/></div><div><div className="profile-name"><h2>{data.profile.name}</h2><span className="account-badge">{demo ? 'DEMO' : 'FREE'}</span></div><p>{demo ? 'Демонстрационный профиль' : `Dota ID: ${data.profile.account_id}`}<span className="profile-separator">·</span><ShieldCheck size={13}/>{demo ? 'Синтетическая выборка' : 'Публичная статистика'}</p></div></div><div className="profile-rank"><span className="rank-symbol"><Swords size={26}/></span><div><strong>{rankName(data.profile.rank_tier)}</strong><small>Без оценки MMR по косвенным данным</small></div></div>{!demo && <a className="external-profile" aria-label="Открыть профиль в OpenDota" href={`https://www.opendota.com/players/${data.profile.account_id}`} target="_blank" rel="noreferrer"><ExternalLink size={17}/></a>}</section>
        <div className="section-caption"><span><span className="status-dot"/>Обзор показателей</span><span>Последние {data.summary.matches} из ≤{data.sample_limit} доступных матчей</span></div>
        <Metrics summary={data.summary}/>
        {data.notice && <div className="small-notice"><CircleAlert size={16}/>{data.notice}</div>}
        {heroes.isError && <div className="small-notice">Справочник героев недоступен. Показаны числовые ID. <button className="text-violet-400" onClick={() => heroes.refetch()}>Повторить</button></div>}
        <div className="analytics-grid"><ProgressChart matches={data.matches}/><HeroPool stats={data.heroes} heroes={heroes.data || []}/></div>
        <div className="insight-strip"><span className="insight-icon"><Sparkles size={22}/></span><div><strong>Осознанная игра начинается с данных</strong><p>Ищи закономерности в матчах и оценивай свой прогресс по доступным показателям.</p></div><span className="coming-feature">AI Coach <span>Скоро</span></span></div>
        <MatchHistory key={`${demo}:${id}`} matches={data.matches} heroes={heroes.data || []} demo={demo}/>
        <div className="data-note"><Clock3 size={14}/><span>{data.source} · Получено {new Date(data.fetched_at).toLocaleString('ru-RU')} · Кэш до 2 минут. Результаты и средние относятся к загруженной выборке. KDA = среднее (K+A)/max(1,D).</span></div>
      </>}
      {session.data && <div className="account-actions"><Link to="/privacy">Управление данными</Link><button onClick={() => setConfirmDelete(true)}><Trash2 size={13}/>Удалить аккаунт</button></div>}
      {confirmDelete && <DeleteAccountDialog onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} pending={remove.isPending} error={remove.error?.message}/>}
    </main>
  </>;
}

function Welcome({ onDemo }: { onDemo: () => void }) {
  return <>
    <section className="welcome-hero"><div className="welcome-copy"><div className="hero-kicker"><span className="status-dot"/>АНАЛИТИКА DOTA 2</div><h2>Каждый матч —<br/>новая <span>возможность.</span></h2><p>Пойми свою игру. Найди сильные стороны.<br/>Сделай следующий шаг к победе с DotaRise.</p><div className="welcome-actions"><Button asChild><a href={`${API_URL}/auth/steam/login`}>Подключить Steam <ArrowUpRight size={16}/></a></Button><Button variant="outline" onClick={onDemo}>Посмотреть демо <ArrowRight size={16}/></Button></div><div className="welcome-trust"><ShieldCheck size={14}/>Без пароля Steam<small>·</small>Только публичные данные</div></div><div className="welcome-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-cross"/><div className="art-rune"><Swords size={100} strokeWidth={1.1}/></div><span className="art-tag tag-one"><TrendingIcon/>PROGRESS IS A MINDSET</span><span className="art-tag tag-two"><span className="status-dot"/>YOUR NEXT LEVEL</span><span className="art-number">RISE</span></div></section>
    <div className="welcome-features">{[{ icon: Swords, title: 'Вся твоя игра', text: 'История матчей, KDA, золото и опыт — в одном пространстве.', number: '01' }, { icon: Gamepad2, title: 'Твои лучшие герои', text: 'Частота выбора и винрейт по героям. Узнай свой сильный пул.', number: '02' }, { icon: Sparkles, title: 'Прогресс в деталях', text: 'Интерактивные графики помогут увидеть динамику каждого матча.', number: '03' }].map(({ icon: Icon, title, text, number }) => <article className="welcome-feature" key={title}><div><Icon size={21}/><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    <div className="welcome-help"><Check size={17}/><p>Уже знаешь свой ID? Введи его в строку поиска выше — вход не нужен.</p><a href="https://www.opendota.com/" target="_blank" rel="noreferrer">Что такое OpenDota <ArrowUpRight size={14}/></a></div>
  </>;
}
function TrendingIcon() { return <ArrowUpRight size={16}/>; }
function DashboardSkeleton() { return <div className="dashboard-skeleton" role="status" aria-label="Загрузка статистики"><span className="sr-only">Загрузка статистики…</span><div className="skeleton h-28"/><div className="metrics-grid">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-36"/>)}</div><div className="skeleton h-80"/><div className="skeleton h-96"/></div>; }
