import { NavLink, Link } from 'react-router-dom';
import { Activity, ArrowUpRight, ChevronRight, FlaskConical, LayoutDashboard, Menu, Shield, Sparkles, Swords, Trophy, Users, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from './ui/button';

const future = [
  { label: 'AI Coach', icon: Sparkles },
  { label: 'Challenges', icon: Trophy }, { label: 'Community', icon: Users },
];
export function Logo() {
  return <Link to="/dashboard" className="brand" aria-label="DotaRise — главная"><span className="brand-mark"><Swords size={22}/></span><span>Dota<span className="text-violet-400">Rise</span><small>PLAY. LEARN. RISE.</small></span></Link>;
}
export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <header className="mobile-header"><Logo/><Button variant="ghost" size="icon" aria-label={open ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</Button></header>
    {open && <button className="sidebar-scrim" aria-label="Закрыть меню" onClick={() => setOpen(false)}/>}
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <Logo/>
      <div className="workspace"><span className="workspace-icon"><Activity size={17}/></span><span>Твоё пространство<small>Личный кабинет</small></span><ChevronRight size={14}/></div>
      <div className="nav-label">ОБЗОР</div>
      <nav aria-label="Основная навигация">
        <NavLink to="/dashboard" className="nav-item" onClick={() => setOpen(false)}><LayoutDashboard size={19}/>Dashboard<span className="nav-dot"/></NavLink>
        <NavLink to="/meta" className="nav-item" onClick={() => setOpen(false)}><FlaskConical size={19}/>Meta Lab<span className="nav-dot"/></NavLink>
        {future.map(({ label, icon: Icon }) => <div key={label} className="nav-item future" aria-disabled="true"><Icon size={19}/>{label}<span className="soon">Скоро</span></div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="pro-card"><div className="pro-icon"><Sparkles size={20}/></div><h3>Больше возможностей.</h3><p>Глубже в игру —<br/>ближе к победе.</p><span className="pro-coming">DotaRise Pro <ArrowUpRight size={15}/><small>Скоро</small></span></div>
        <Link className="privacy-link" to="/privacy" onClick={() => setOpen(false)}><Shield size={15}/>Конфиденциальность</Link>
        <div className="sidebar-footer"><span className="status-dot"/>DotaRise <span>v0.1 · Early access</span></div>
      </div>
    </aside>
    <div className="main-shell">{children}<footer className="page-footer"><span>© {new Date().getFullYear()} DotaRise</span><span>Становись лучше. Матч за матчем.</span><a href="https://www.opendota.com/" target="_blank" rel="noreferrer">Данные OpenDota <ArrowUpRight size={12}/></a></footer></div>
  </div>;
}
