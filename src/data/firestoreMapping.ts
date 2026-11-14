import { sortLines, type OrderLine, type TableSession } from '../domain/session';
import type { BarState } from '../domain/bar';

/** Firestore 結構：tables/{桌號} = { openedAt, note, lines: { [lineId]: LineDoc } } */
export type LineDoc = {
  menuItemId?: string;
  name?: string;
  qty?: number;
  addedAt?: number;
  tags?: string[];
  note?: string;
};
export type TableDoc = { openedAt?: number; note?: string; lines?: Record<string, LineDoc> };

export type FieldOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'inc'; path: string[]; by: number }
  | { op: 'del'; path: string[] };
export type DocWrite = { kind: 'none' } | { kind: 'delete' } | { kind: 'merge'; ops: FieldOp[] };

export function toSession(tableId: string, doc: TableDoc | undefined): TableSession | undefined {
  const lines: OrderLine[] = Object.entries(doc?.lines ?? {})
    .filter(([, l]) => (l.qty ?? 0) > 0 && typeof l.name === 'string')
    .map(([lineId, l]) => ({
      lineId,
      menuItemId: l.menuItemId ?? lineId,
      name: l.name!,
      qty: l.qty!,
      addedAt: l.addedAt ?? 0,
      tags: l.tags ?? [],
      note: l.note ?? '',
    }));
  const note = doc?.note ?? '';
  if (lines.length === 0 && note === '') return undefined;
  const sorted = sortLines(lines);
  const session: TableSession = { tableId, openedAt: doc?.openedAt ?? sorted[0]?.addedAt ?? 0, note, lines: sorted };
  // 正常開桌一定會寫 openedAt；沒有它代表文件是被離線補傳的寫入重建的（桌已被別支手機清掉）
  if (doc?.openedAt === undefined) session.recovered = true;
  return session;
}

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

/** 前後兩個狀態的最小寫入：數量一律用遞增，避免多裝置同時操作互相覆蓋 */
export function diff(prev: TableSession | undefined, next: TableSession | undefined): DocWrite {
  if (!next) return prev ? { kind: 'delete' } : { kind: 'none' };
  const ops: FieldOp[] = [];
  if (!prev) ops.push({ op: 'set', path: ['openedAt'], value: next.openedAt });
  if (!prev || prev.note !== next.note) ops.push({ op: 'set', path: ['note'], value: next.note });

  const before = new Map((prev?.lines ?? []).map((l) => [l.lineId, l]));
  for (const l of next.lines) {
    const p = before.get(l.lineId);
    const at = (f: string) => ['lines', l.lineId, f];
    if (!p) {
      ops.push(
        { op: 'set', path: at('menuItemId'), value: l.menuItemId },
        { op: 'set', path: at('name'), value: l.name },
        { op: 'set', path: at('addedAt'), value: l.addedAt },
        { op: 'set', path: at('tags'), value: l.tags },
        { op: 'set', path: at('note'), value: l.note },
        { op: 'inc', path: at('qty'), by: l.qty },
      );
      continue;
    }
    if (p.qty !== l.qty) {
      // 連同識別欄位一起寫（值不變、可重複寫）：若文件已被別支手機清掉，補傳時才不會只剩一個數字
      ops.push(
        { op: 'set', path: at('menuItemId'), value: l.menuItemId },
        { op: 'set', path: at('name'), value: l.name },
        { op: 'set', path: at('addedAt'), value: l.addedAt },
        { op: 'set', path: at('tags'), value: l.tags },
        { op: 'set', path: at('note'), value: l.note },
        { op: 'inc', path: at('qty'), by: l.qty - p.qty },
      );
      continue;
    }
    if (!sameTags(p.tags, l.tags)) ops.push({ op: 'set', path: at('tags'), value: l.tags });
    if (p.note !== l.note) ops.push({ op: 'set', path: at('note'), value: l.note });
  }
  const kept = new Set(next.lines.map((l) => l.lineId));
  for (const id of before.keys()) if (!kept.has(id)) ops.push({ op: 'del', path: ['lines', id] });

  return ops.length ? { kind: 'merge', ops } : { kind: 'none' };
}


// ---- 整店：tables/{桌號}、history/{id}、menu/{id}、meta/business、meta/settings ----

export type DocPatch = { path: [string, string]; write: DocWrite | { kind: 'set'; data: unknown } };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function wholeDocs(col: string, prev: Record<string, unknown>, next: Record<string, unknown>): DocPatch[] {
  const out: DocPatch[] = [];
  for (const [id, v] of Object.entries(next)) {
    if (!same(prev[id], v)) out.push({ path: [col, id], write: { kind: 'set', data: v } });
  }
  for (const id of Object.keys(prev)) if (!(id in next)) out.push({ path: [col, id], write: { kind: 'delete' } });
  return out;
}

/** 前後整店狀態 → 各文件的最小寫入，由 Firestore 轉接層一次批次送出 */
export function diffState(prev: BarState, next: BarState): DocPatch[] {
  const out: DocPatch[] = [];
  const ids = new Set([...Object.keys(prev.tables), ...Object.keys(next.tables)]);
  for (const id of ids) {
    const w = diff(prev.tables[id], next.tables[id]);
    if (w.kind !== 'none') out.push({ path: ['tables', id], write: w });
  }
  out.push(...wholeDocs('history', prev.history, next.history));
  out.push(...wholeDocs('menu', prev.menu, next.menu));
  const business = (s: BarState) => ({ day: s.day, lastEnd: s.lastEnd });
  if (!same(business(prev), business(next))) {
    out.push({ path: ['meta', 'business'], write: { kind: 'set', data: business(next) } });
  }
  if (!same(prev.settings, next.settings)) {
    out.push({ path: ['meta', 'settings'], write: { kind: 'set', data: next.settings } });
  }
  return out;
}
