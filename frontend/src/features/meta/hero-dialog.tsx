import { useEffect, useRef } from 'react';
import { BookmarkPlus, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { MetaHero } from '../../types/meta';
import { MetaHeroImage } from './hero-image';
import { attributeLabels, number, percent, roleLabels } from './helpers';

export function HeroDialog({ hero, selected, full, onToggle, onClose }: { hero: MetaHero; selected: boolean; full: boolean; onToggle: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="confirm-dialog meta-dialog" aria-labelledby="hero-detail-title" onCancel={onClose}>
    <Button autoFocus className="meta-dialog-close" size="icon" variant="ghost" aria-label="Закрыть детали героя" onClick={onClose}><X size={18}/></Button>
    <MetaHeroImage hero={hero}/><div className="eyebrow">META LAB / HERO PROFILE</div><h2 id="hero-detail-title">{hero.name}</h2>
    <div className="meta-tags"><span>{attributeLabels[hero.primary_attr || ''] || 'Атрибут неизвестен'}</span><span>{hero.attack_type === 'Melee' ? 'Ближний бой' : hero.attack_type === 'Ranged' ? 'Дальний бой' : 'Тип атаки неизвестен'}</span></div>
    <div className="meta-detail-grid">{[
      ['Winrate', percent(hero.winrate)], ['Pickrate · оценка', percent(hero.pickrate)],
      ['Выборов', number(hero.picks)], ['Побед', number(hero.wins)],
      ['Доля всех выборов', percent(hero.pick_share)], ['95% Wilson', hero.confidence_low == null ? '—' : `${number(hero.confidence_low, 2)}–${number(hero.confidence_high, 2)}%`],
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="meta-tags">{hero.roles.map(role => <span key={role}>{roleLabels[role] || role}</span>)}</div>
    <p>Winrate = победы / выборы. Pickrate — оценка из 10 слотов, а не измеренная доля уникальных матчей. Wilson показывает неопределённость доли в выборке; он не предсказывает вашу следующую игру.</p>
    {hero.bans != null && <p>Банов на про-сцене: {number(hero.bans)}. Banrate не вычисляется: общего числа драфтов источник не передаёт.</p>}
    <div><Button variant="outline" onClick={onClose}>Закрыть</Button><Button onClick={onToggle} disabled={!selected && full}>{selected ? <Check size={15}/> : <BookmarkPlus size={15}/>} {selected ? 'Убрать из пула' : full ? 'Пул заполнен' : 'Добавить в пул'}</Button></div>
  </dialog>;
}
