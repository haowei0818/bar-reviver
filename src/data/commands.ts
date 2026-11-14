import {
  emptyState,
  withTable,
  clearTable,
  restoreSession,
  endBusinessDay,
  undoEndBusinessDay,
  type BarState,
} from '../domain/bar';
import { addItem, changeQty, setLineNotes, setTableNote, type TableSession } from '../domain/session';
import type { BarRepo } from './repo';
import { addMenuItem, updateMenuItem, moveMenuItem } from '../domain/menu';
import { rotateAccessKey } from '../domain/access';

/** 儲存端只需提供兩件事：訂閱整店狀態、以純函式更新整店狀態 */
export type Store = {
  subscribe(cb: (s: BarState) => void): () => void;
  transact(fn: (s: BarState) => BarState): Promise<void>;
};

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 12)
    : Math.random().toString(36).slice(2, 14);

export { emptyState };

/** 把領域規則接到任一種儲存端：本機與 Firestore 共用同一份行為 */
export function repoFrom(store: Store, now: () => number, genId: () => string): BarRepo {
  const need = (s: TableSession | undefined, tableId: string) => {
    if (!s) throw new Error(`${tableId} 是空桌`);
    return s;
  };
  const table = (t: string, fn: (s: TableSession | undefined) => TableSession | undefined) =>
    store.transact((st) => withTable(st, t, fn, now()));
  return {
    subscribe: store.subscribe,
    addItem: (t, item) => table(t, (s) => addItem(s, t, item, now())),
    changeQty: (t, lineId, d) => table(t, (s) => changeQty(need(s, t), lineId, d)),
    setLineNotes: (t, lineId, notes, q) => table(t, (s) => setLineNotes(need(s, t), lineId, notes, q, genId(), now())),
    setTableNote: (t, note) => table(t, (s) => setTableNote(s, t, note, now())),
    clearTable: (t) => store.transact((st) => clearTable(st, t, now(), genId())),
    restoreSession: (id) => store.transact((st) => restoreSession(st, id)),
    endBusinessDay: () => store.transact((st) => endBusinessDay(st, now(), genId)),
    undoEndBusinessDay: () => store.transact((st) => undoEndBusinessDay(st, now())),
    addMenuItem: (input) => store.transact((st) => ({ ...st, menu: addMenuItem(st.menu, input, `m-${genId()}`) })),
    updateMenuItem: (id, patch) => store.transact((st) => ({ ...st, menu: updateMenuItem(st.menu, id, patch) })),
    moveMenuItem: (id, dir) => store.transact((st) => ({ ...st, menu: moveMenuItem(st.menu, id, dir) })),
    rotateAccessKey: (key) => store.transact((st) => rotateAccessKey(st, key)),
  };
}
