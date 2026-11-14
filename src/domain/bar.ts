import type { MenuItem } from './menu';
import type { TableSession } from './session';

/** 已清桌、移入歷史的桌次 */
export type ClosedSession = TableSession & {
  id: string;
  closedAt: number;
  dayId: string;
  dayStartedAt: number;
};
export type BusinessDay = { id: string; startedAt: number };
/** 最近一次結束營業的紀錄，用於 10 分鐘內復原 */
export type EndRecord = { day: BusinessDay; endedAt: number; historyIds: string[] };

/** 整間店的狀態：畫面與資料層都以它為準 */
export type BarState = {
  tables: Record<string, TableSession>;
  history: Record<string, ClosedSession>;
  /** 空物件代表尚未自訂酒單，使用初始酒單 */
  menu: Record<string, MenuItem>;
  day: BusinessDay | null;
  lastEnd: EndRecord | null;
  settings: { accessKey: string | null };
};

export const emptyState = (): BarState => ({
  tables: {},
  history: {},
  menu: {},
  day: null,
  lastEnd: null,
  settings: { accessKey: null },
});

/** 對某一桌套用規則；任何桌位操作都會自動開始營業日 */
export function withTable(
  state: BarState,
  tableId: string,
  fn: (s: TableSession | undefined) => TableSession | undefined,
  now: number,
): BarState {
  const next = fn(state.tables[tableId]);
  const tables = { ...state.tables };
  if (next) tables[tableId] = next;
  else delete tables[tableId];
  const day = state.day ?? (next ? { id: `d-${now}`, startedAt: now } : null);
  return { ...state, tables, day };
}

// ---- T4 清桌、歷史、還原 ----

function toClosed(session: TableSession, id: string, closedAt: number, day: BusinessDay): ClosedSession {
  return { ...session, id, closedAt, dayId: day.id, dayStartedAt: day.startedAt };
}

/** 清桌：桌次移入歷史，桌變回空桌 */
export function clearTable(state: BarState, tableId: string, now: number, historyId: string): BarState {
  const session = state.tables[tableId];
  if (!session) throw new Error(`${tableId} 已是空桌`);
  const day = state.day ?? { id: `d-${session.openedAt}`, startedAt: session.openedAt };
  const tables = { ...state.tables };
  delete tables[tableId];
  return { ...state, tables, day, history: { ...state.history, [historyId]: toClosed(session, historyId, now, day) } };
}

/** 從歷史還原：該桌必須是空桌 */
export function restoreSession(state: BarState, historyId: string): BarState {
  const closed = state.history[historyId];
  if (!closed) throw new Error('找不到這筆歷史');
  if (state.tables[closed.tableId]) throw new Error(`${closed.tableId} 已有新客人，無法還原`);
  const { id: _id, closedAt: _c, dayId: _d, dayStartedAt: _s, recovered: _r, ...session } = closed;
  const history = { ...state.history };
  delete history[historyId];
  return { ...state, history, tables: { ...state.tables, [closed.tableId]: session } };
}

/** 歷史依營業日分組：營業日新到舊、組內清桌時間新到舊 */
export function historyByDay(state: BarState): { day: BusinessDay; sessions: ClosedSession[] }[] {
  const groups = new Map<string, { day: BusinessDay; sessions: ClosedSession[] }>();
  for (const h of Object.values(state.history)) {
    const g = groups.get(h.dayId) ?? { day: { id: h.dayId, startedAt: h.dayStartedAt }, sessions: [] };
    g.sessions.push(h);
    groups.set(h.dayId, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.day.startedAt - a.day.startedAt)
    .map((g) => ({ ...g, sessions: g.sessions.sort((a, b) => b.closedAt - a.closedAt) }));
}

// ---- T5 營業日 ----

export const HISTORY_DAYS = 7;
export const UNDO_END_MS = 10 * 60 * 1000;
export const REMIND_AFTER_MS = 18 * 60 * 60 * 1000;

/** 只留最近 HISTORY_DAYS 個營業日的歷史 */
function prune(history: BarState['history']): BarState['history'] {
  const days = [...new Set(Object.values(history).map((h) => h.dayStartedAt))].sort((a, b) => b - a);
  const keep = new Set(days.slice(0, HISTORY_DAYS));
  return Object.fromEntries(Object.entries(history).filter(([, h]) => keep.has(h.dayStartedAt)));
}

/** 結束營業：所有使用中的桌封存、營業日清空、記錄以便 10 分鐘內復原 */
export function endBusinessDay(state: BarState, now: number, genId: () => string): BarState {
  const day = state.day;
  if (!day) throw new Error('目前沒有營業中的營業日');
  const history = { ...state.history };
  const historyIds: string[] = [];
  for (const session of Object.values(state.tables).sort((a, b) => a.tableId.localeCompare(b.tableId))) {
    const id = genId();
    history[id] = toClosed(session, id, now, day);
    historyIds.push(id);
  }
  return { ...state, tables: {}, day: null, history: prune(history), lastEnd: { day, endedAt: now, historyIds } };
}

/** 10 分鐘內、且尚未開始新的營業日 */
export function canUndoEnd(state: BarState, now: number): boolean {
  return !!state.lastEnd && state.day === null && now - state.lastEnd.endedAt <= UNDO_END_MS;
}

export function undoEndBusinessDay(state: BarState, now: number): BarState {
  if (!canUndoEnd(state, now)) throw new Error('已超過 10 分鐘或已開始新的營業日，請從歷史逐桌還原');
  let st: BarState = state;
  for (const id of state.lastEnd!.historyIds) {
    const h = st.history[id];
    if (h && !st.tables[h.tableId]) st = restoreSession(st, id);
  }
  return { ...st, day: state.lastEnd!.day, lastEnd: null };
}

export function needsEndReminder(state: BarState, now: number): boolean {
  return !!state.day && now - state.day.startedAt >= REMIND_AFTER_MS;
}
