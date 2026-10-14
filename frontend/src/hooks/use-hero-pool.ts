import { useEffect, useState } from 'react';

const KEY = 'dotarise_hero_pool_v1';
function readPool(raw: string | null): number[] {
  try {
    if (!raw || raw.length > 1024) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0))].slice(0, 5) : [];
  } catch { return []; }
}
export function useHeroPool() {
  const [ids, setIds] = useState<number[]>(() => {
    try {
      return readPool(localStorage.getItem(KEY));
    } catch { return []; }
  });
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    function sync(event: StorageEvent) {
      try {
        if (event.storageArea === localStorage && (event.key === KEY || event.key === null)) setIds(readPool(event.newValue));
      } catch { setPersistent(false); }
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { setPersistent(false); }
  }, [ids]);
  function toggle(id: number) {
    setIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < 5 ? [...previous, id] : previous);
  }
  return { ids, toggle, persistent };
}
