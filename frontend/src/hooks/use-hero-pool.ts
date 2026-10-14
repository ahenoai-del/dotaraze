import { useEffect, useState } from 'react';

const KEY = 'dotarise_hero_pool_v1';
export function useHeroPool() {
  const [ids, setIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw || raw.length > 1024) return [];
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value) ? [...new Set(value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0))].slice(0, 5) : [];
    } catch { return []; }
  });
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { setPersistent(false); }
  }, [ids]);
  function toggle(id: number) {
    setIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < 5 ? [...previous, id] : previous);
  }
  return { ids, toggle, persistent };
}
