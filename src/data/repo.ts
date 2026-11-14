import type { BarState } from '../domain/bar';
import type { LineNotes, TableSession } from '../domain/session';
import type { CategoryId, MenuItem } from '../domain/menu';

export type Sessions = Record<string, TableSession>;

export type SyncStatus = { online: boolean; pendingDocs: number; error?: string };

/** 資料層對外介面：畫面只依賴這些動作 */
export interface BarRepo {
  subscribe(cb: (state: BarState) => void): () => void;
  addItem(tableId: string, item: { id: string; name: string }): Promise<void>;
  changeQty(tableId: string, lineId: string, delta: number): Promise<void>;
  setLineNotes(tableId: string, lineId: string, notes: LineNotes, applyQty: number): Promise<void>;
  setTableNote(tableId: string, note: string): Promise<void>;
  clearTable(tableId: string): Promise<void>;
  restoreSession(historyId: string): Promise<void>;
  endBusinessDay(): Promise<void>;
  undoEndBusinessDay(): Promise<void>;
  addMenuItem(input: { categoryId: CategoryId; name: string; price: number | null }): Promise<void>;
  updateMenuItem(id: string, patch: Partial<Pick<MenuItem, 'name' | 'price' | 'active'>>): Promise<void>;
  moveMenuItem(id: string, dir: -1 | 1): Promise<void>;
  rotateAccessKey(key: string): Promise<void>;
  /** 雲端模式才有：連線與待同步狀態 */
  onSync?(cb: (s: SyncStatus) => void): () => void;
}
/** @deprecated 舊名稱 */
export type TableRepo = BarRepo;
