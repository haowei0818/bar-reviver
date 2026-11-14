import type { OrderLine } from '../domain/session';

const TZ = 'Asia/Taipei';
export const hhmm = (t: number) =>
  new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(t);
export const dayLabel = (t: number) =>
  new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: TZ }).format(t);
export const notesText = (l: OrderLine) => [...l.tags, l.note].filter(Boolean).join('、');
export const lineLabel = (l: OrderLine) => (notesText(l) ? `${l.name}｜${notesText(l)}` : l.name);
export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const md = (t: number) =>
  new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', timeZone: TZ }).format(t);
