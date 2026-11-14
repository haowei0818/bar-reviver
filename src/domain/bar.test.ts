import { describe, it, expect } from 'vitest';
import { emptyState, withTable, clearTable, restoreSession, historyByDay, type BarState } from './bar';
import { addItem, setTableNote } from './session';

const yewei = { id: 'r-02', name: '夜未央' };
const withDrink = (st: BarState, t: string, now: number) => withTable(st, t, (s) => addItem(s, t, yewei, now), now);

describe('T4 清桌', () => {
  it('清桌 → 桌次移入歷史（記下清桌時間與營業日），桌變回空桌', () => {
    let st = withDrink(emptyState(), 'B5', 1000);
    st = withTable(st, 'B5', (s) => setTableNote(s, 'B5', '壽星', 1100), 1100);
    st = clearTable(st, 'B5', 2000, 'h1');
    expect(st.tables.B5).toBeUndefined();
    expect(st.history.h1).toMatchObject({
      id: 'h1', tableId: 'B5', openedAt: 1000, closedAt: 2000, dayId: 'd-1000', dayStartedAt: 1000, note: '壽星',
    });
    expect(st.history.h1.lines[0]).toMatchObject({ name: '夜未央', qty: 1 });
  });

  it('清空桌時拒絕', () => {
    expect(() => clearTable(emptyState(), 'B5', 2000, 'h1')).toThrow('空桌');
  });
});

describe('T4 還原', () => {
  it('桌為空桌時可還原，歷史中移除', () => {
    let st = clearTable(withDrink(emptyState(), 'B5', 1000), 'B5', 2000, 'h1');
    st = restoreSession(st, 'h1');
    expect(st.history.h1).toBeUndefined();
    expect(st.tables.B5).toMatchObject({ tableId: 'B5', openedAt: 1000, lines: [{ name: '夜未央', qty: 1 }] });
    expect(Object.keys(st.tables.B5)).not.toContain('closedAt');
  });

  it('桌上已有新客人 → 拒絕還原', () => {
    let st = clearTable(withDrink(emptyState(), 'B5', 1000), 'B5', 2000, 'h1');
    st = withDrink(st, 'B5', 3000);
    expect(() => restoreSession(st, 'h1')).toThrow('已有新客人');
  });

  it('不存在的歷史拒絕', () => {
    expect(() => restoreSession(emptyState(), 'nope')).toThrow();
  });
});

describe('T4 歷史列表', () => {
  it('依營業日分組（新到舊），組內依清桌時間新到舊', () => {
    let st = withDrink(emptyState(), 'B1', 1000);
    st = withDrink(st, 'B2', 1100);
    st = clearTable(st, 'B1', 2000, 'h1');
    st = clearTable(st, 'B2', 3000, 'h2');
    // 模擬隔天另一個營業日的歷史
    st = { ...st, history: { ...st.history, h0: { ...st.history.h1, id: 'h0', dayId: 'd-1', dayStartedAt: 1, closedAt: 500 } } };
    const groups = historyByDay(st);
    expect(groups.map((g) => g.day.id)).toEqual(['d-1000', 'd-1']);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(['h2', 'h1']);
  });
});
