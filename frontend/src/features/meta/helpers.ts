import type { MetaHero } from '../../types/meta';

export const roleLabels: Record<string, string> = { Carry: 'Керри', Support: 'Поддержка', Nuker: 'Магический урон', Disabler: 'Контроль', Durable: 'Живучесть', Escape: 'Мобильность', Initiator: 'Инициация', Pusher: 'Снос строений', Jungler: 'Лес' };
export const attributeLabels: Record<string, string> = { str: 'Сила', agi: 'Ловкость', int: 'Интеллект', all: 'Универсальный' };
export const brackets: Record<string, string> = { '1': 'Рекрут', '2': 'Страж', '3': 'Рыцарь', '4': 'Герой', '5': 'Легенда', '6': 'Властелин', '7': 'Божество', '8': 'Титан' };
export const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
export const percent = (value: number | null | undefined) => value == null ? '—' : `${number(value, 2)}%`;
export type SortMetric = 'confidence_low' | 'winrate' | 'pickrate' | 'picks';
export function orderHeroes(heroes: MetaHero[], metric: SortMetric, descending = true) {
  return [...heroes].sort((a, b) => {
    const first = a[metric], second = b[metric];
    if (first == null && second == null) return a.name.localeCompare(b.name);
    if (first == null) return 1;
    if (second == null) return -1;
    return (descending ? second - first : first - second) || a.name.localeCompare(b.name);
  });
}
