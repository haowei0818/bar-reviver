import { describe, it, expect } from 'vitest';
import {
  emptyState,
  withTable,
  clearTable,
  restoreSession,
  endBusinessDay,
  canUndoEnd,
  undoEndBusinessDay,
  needsEndReminder,
  HISTORY_DAYS,
  type BarState,
} from './bar';
import { addItem } from './session';

const H = 60 * 60 * 1000;
const M = 60 * 1000;
const yewei = { id: 'r-02', name: '夜未央' };
const drink = (st: BarState, t: string, now: number) => withTable(st, t, (s) => addItem(s, t, yewei, now), now);
const ids = () => {
  let n = 0;
  return () => `e${++n}`;
};

describe('T5 營業日', () => {
  it('第一筆操作自動開始營業日', () => {
    expect(drink(emptyState(), 'B1', 1000).day).toEqual({ id: 'd-1000', startedAt: 1000 });
  });

  it('結束營業：所有使用中的桌封存到歷史，營業日清空', () => {
    let st = drink(drink(emptyState(), 'B1', 1000), 'C2', 2000);
    st = clearTable(st, 'B1', 3000, 'h1'); // 已清桌的也屬於這個營業日
    st = drink(st, 'B1', 3500);
    st = endBusinessDay(st, 10 * H, ids());
    expect(st.tables).toEqual({});
    expect(st.day).toBeNull();
    expect(Object.values(st.history).map((h) => [h.tableId, h.dayId]).sort()).toEqual([
      ['B1', 'd-1000'],
      ['B1', 'd-1000'],
      ['C2', 'd-1000'],
    ]);
    expect(st.lastEnd).toMatchObject({ day: { id: 'd-1000' }, endedAt: 10 * H, historyIds: ['e1', 'e2'] });
  });

  it('沒有營業中時拒絕結束', () => {
    expect(() => endBusinessDay(emptyState(), 1000, ids())).toThrow('沒有營業中');
  });

  it('10 分鐘內可復原：桌況與結束前一致、營業日恢復', () => {
    const before = drink(drink(emptyState(), 'B1', 1000), 'C2', 2000);
    const ended = endBusinessDay(before, 5 * H, ids());
    expect(canUndoEnd(ended, 5 * H + 10 * M)).toBe(true);
    const undone = undoEndBusinessDay(ended, 5 * H + 10 * M);
    expect(undone.tables).toEqual(before.tables);
    expect(undone.day).toEqual(before.day);
    expect(undone.history).toEqual({});
    expect(undone.lastEnd).toBeNull();
  });

  it('超過 10 分鐘不能復原', () => {
    const ended = endBusinessDay(drink(emptyState(), 'B1', 1000), 5 * H, ids());
    expect(canUndoEnd(ended, 5 * H + 10 * M + 1)).toBe(false);
    expect(() => undoEndBusinessDay(ended, 5 * H + 11 * M)).toThrow();
  });

  it('結束後已開始新營業日 → 不能復原', () => {
    let st = endBusinessDay(drink(emptyState(), 'B1', 1000), 5 * H, ids());
    st = drink(st, 'C1', 5 * H + M);
    expect(canUndoEnd(st, 5 * H + 2 * M)).toBe(false);
  });

  it('復原時略過已被逐桌還原的桌次', () => {
    let st = endBusinessDay(drink(drink(emptyState(), 'B1', 1000), 'C2', 2000), 5 * H, ids());
    st = restoreSession(st, 'e1'); // B1 先被手動還原（此時 day 仍為 null）
    st = { ...st, day: null };
    const undone = undoEndBusinessDay(st, 5 * H + M);
    expect(Object.keys(undone.tables).sort()).toEqual(['B1', 'C2']);
  });

  it('營業日超過 18 小時 → 提醒', () => {
    const st = drink(emptyState(), 'B1', 0);
    expect(needsEndReminder(st, 18 * H - 1)).toBe(false);
    expect(needsEndReminder(st, 18 * H)).toBe(true);
    expect(needsEndReminder(emptyState(), 100 * H)).toBe(false);
  });

  it(`歷史只保留最近 ${HISTORY_DAYS} 個營業日`, () => {
    expect(HISTORY_DAYS).toBe(7);
    let st = emptyState();
    const gen = ids();
    for (let d = 0; d < 8; d++) {
      st = drink(st, 'B1', d * 24 * H);
      st = endBusinessDay(st, d * 24 * H + 6 * H, gen);
    }
    const days = new Set(Object.values(st.history).map((h) => h.dayStartedAt));
    expect(days.size).toBe(7);
    expect(days.has(0)).toBe(false); // 第 1 天被刪除
  });
});
