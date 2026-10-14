import { Swords } from 'lucide-react';
import type { MetaHero } from '../../types/meta';

export function MetaHeroImage({ hero, className = '' }: { hero: MetaHero; className?: string }) {
  return <div className={`meta-hero-image ${className}`}><Swords size={24}/>{hero.image && <img src={hero.image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }}/>}</div>;
}
