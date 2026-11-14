import { describe, it, expect, vi } from 'vitest';
import { createLocalRepo } from './localRepo';
import { toSession, diff, diffState } from './firestoreMapping';
import { emptyState, type BarState } from '../domain/bar';
import type { TableSession } from '../domain/session';

const yewei = { id: 'r-02', name: '夜未央' };
const ny = { id: 'c-07', name: 'New York Sour' };
const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};
const local = (now = 1000) => createLocalRepo(localStorage, () => now, ids());
const lastOf = (cb: ReturnType<typeof vi.fn>) => cb.mock.calls.at(-1)![0];

describe('本機資料層（無 Firebase 設定時使用，也是資料層行為的參考實作）', () => {
  it('訂閱時立即收到目前狀態（初始為空）', () => {
    const cb = vi.fn();
    local().subscribe(cb);
    expect(cb).toHaveBeenLastCalledWith(emptyState());
  });

  it('加酒後通知訂閱者，同酒累加', async () => {
    const repo = local();
    const cb = vi.fn();
    repo.subscribe(cb);
    await repo.addItem('B5', yewei);
    await repo.addItem('B5', yewei);
    expect(lastOf(cb).tables.B5.lines).toMatchObject([{ menuItemId: 'r-02', name: '夜未央', qty: 2 }]);
  });

  it('重新整理（新建 repo 實例）後資料還在', async () => {
    await local().addItem('C3', ny);
    const cb = vi.fn();
    local(2000).subscribe(cb);
    expect(lastOf(cb).tables.C3.lines[0].name).toBe('New York Sour');
  });

  it('取消訂閱後不再通知', async () => {
    const repo = local();
    const cb = vi.fn();
    const off = repo.subscribe(cb);
    off();
    await repo.addItem('B1', yewei);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('T2：備註拆杯、數量、桌備註都經由同一個資料層', async () => {
    const repo = local();
    const cb = vi.fn();
    repo.subscribe(cb);
    await repo.addItem('B5', yewei);
    await repo.addItem('B5', yewei);
    await repo.setLineNotes('B5', 'r-02', { tags: ['少甜'], note: '' }, 1);
    expect(lastOf(cb).tables.B5.lines.map((l: { lineId: string; qty: number }) => [l.lineId, l.qty])).toEqual([
      ['r-02', 1],
      ['id1', 1],
    ]);
    await repo.changeQty('B5', 'id1', -1);
    await repo.setTableNote('B5', '分開結帳');
    expect(lastOf(cb).tables.B5).toMatchObject({ note: '分開結帳', lines: [{ lineId: 'r-02', qty: 1 }] });
    await repo.changeQty('B5', 'r-02', -1);
    await repo.setTableNote('B5', '');
    expect(lastOf(cb).tables.B5).toBeUndefined();
  });
});

// ---- Firestore：tables/{桌號} = { openedAt, note, lines: { [lineId]: {...} } } ----

const line = (over: Partial<TableSession['lines'][0]> = {}) => ({
  lineId: 'r-02', menuItemId: 'r-02', name: '夜未央', qty: 1, addedAt: 1000, tags: [], note: '', ...over,
});
const session = (over: Partial<TableSession> = {}): TableSession => ({
  tableId: 'B5', openedAt: 1000, note: '', lines: [line()], ...over,
});

describe('Firestore 讀取對應 toSession', () => {
  it('不存在、沒有酒也沒有桌備註 → 空桌', () => {
    expect(toSession('B1', undefined)).toBeUndefined();
    expect(toSession('B1', { lines: {}, note: '' })).toBeUndefined();
  });

  it('完整文件 → 桌次，lines 依統一規則排序', () => {
    const s = toSession('B5', {
      openedAt: 900,
      note: '壽星',
      lines: {
        x1: { menuItemId: 'r-02', name: '夜未央', qty: 1, addedAt: 1000, tags: ['少甜'], note: '' },
        'r-02': { menuItemId: 'r-02', name: '夜未央', qty: 1, addedAt: 1000, tags: [], note: '' },
        'c-07': { menuItemId: 'c-07', name: 'New York Sour', qty: 2, addedAt: 500, tags: [], note: '' },
      },
    });
    expect(s!.openedAt).toBe(900);
    expect(s!.note).toBe('壽星');
    expect(s!.lines.map((l) => l.lineId)).toEqual(['c-07', 'r-02', 'x1']);
  });

  it('沒有 openedAt 的文件 → 視為離線補傳重建，開桌時間取最早加入時間', () => {
    const s = toSession('B5', { lines: { 'r-02': { name: '夜未央', qty: 2, addedAt: 1000 } } });
    expect(s).toEqual({ ...session({ lines: [line({ qty: 2 })] }), recovered: true });
  });

  it('qty ≤ 0 或缺名稱（併發刪除後殘留的遞增）的行不顯示', () => {
    expect(toSession('B5', { lines: { a: { name: '夜未央', qty: 0, addedAt: 1 } } })).toBeUndefined();
    expect(toSession('B5', { lines: { a: { qty: 1 } } })).toBeUndefined();
  });
});

describe('Firestore 寫入差異 diff', () => {
  it('空桌 → 第一杯：設定開桌時間、桌備註、行內容，數量用遞增', () => {
    expect(diff(undefined, session())).toEqual({
      kind: 'merge',
      ops: [
        { op: 'set', path: ['openedAt'], value: 1000 },
        { op: 'set', path: ['note'], value: '' },
        { op: 'set', path: ['lines', 'r-02', 'menuItemId'], value: 'r-02' },
        { op: 'set', path: ['lines', 'r-02', 'name'], value: '夜未央' },
        { op: 'set', path: ['lines', 'r-02', 'addedAt'], value: 1000 },
        { op: 'set', path: ['lines', 'r-02', 'tags'], value: [] },
        { op: 'set', path: ['lines', 'r-02', 'note'], value: '' },
        { op: 'inc', path: ['lines', 'r-02', 'qty'], by: 1 },
      ],
    });
  });

  it('同一行加一杯 → 數量用遞增（兩支手機同時加不會互相覆蓋），並附上不變的識別欄位', () => {
    expect(diff(session(), session({ lines: [line({ qty: 2 })] }))).toEqual({
      kind: 'merge',
      ops: [
        { op: 'set', path: ['lines', 'r-02', 'menuItemId'], value: 'r-02' },
        { op: 'set', path: ['lines', 'r-02', 'name'], value: '夜未央' },
        { op: 'set', path: ['lines', 'r-02', 'addedAt'], value: 1000 },
        { op: 'set', path: ['lines', 'r-02', 'tags'], value: [] },
        { op: 'set', path: ['lines', 'r-02', 'note'], value: '' },
        { op: 'inc', path: ['lines', 'r-02', 'qty'], by: 1 },
      ],
    });
  });

  it('改備註 → 只寫 tags 與 note', () => {
    expect(diff(session(), session({ lines: [line({ tags: ['少甜'], note: '換波本' })] }))).toEqual({
      kind: 'merge',
      ops: [
        { op: 'set', path: ['lines', 'r-02', 'tags'], value: ['少甜'] },
        { op: 'set', path: ['lines', 'r-02', 'note'], value: '換波本' },
      ],
    });
  });

  it('行被移除 → 刪除該欄位；桌備註變更 → 只寫 note', () => {
    const prev = session({ lines: [line(), line({ lineId: 'c-07', menuItemId: 'c-07', name: 'NY' })] });
    expect(diff(prev, session({ note: '壽星' }))).toEqual({
      kind: 'merge',
      ops: [
        { op: 'set', path: ['note'], value: '壽星' },
        { op: 'del', path: ['lines', 'c-07'] },
      ],
    });
  });

  it('變回空桌 → 刪除整份文件；沒變化 → 不寫', () => {
    expect(diff(session(), undefined)).toEqual({ kind: 'delete' });
    expect(diff(session(), session())).toEqual({ kind: 'none' });
    expect(diff(undefined, undefined)).toEqual({ kind: 'none' });
  });
});

describe('整店狀態', () => {
  it('第一次操作桌位時自動開始營業日', async () => {
    const repo = local(5000);
    const cb = vi.fn();
    repo.subscribe(cb);
    expect(lastOf(cb).day).toBeNull();
    await repo.addItem('B1', yewei);
    expect(lastOf(cb).day).toEqual({ id: 'd-5000', startedAt: 5000 });
  });

  it('T1 試用資料（v1）自動搬移', () => {
    localStorage.setItem('bar-reviver:sessions:v1', JSON.stringify({ B2: session({ tableId: 'B2' }) }));
    const cb = vi.fn();
    local().subscribe(cb);
    expect(lastOf(cb).tables.B2.lines[0].name).toBe('夜未央');
  });
});

describe('Firestore 整店差異 diffState（每份文件一筆寫入，一次批次送出）', () => {
  const base = (over: Partial<BarState> = {}): BarState => ({ ...emptyState(), ...over });

  it('桌位沿用細部差異（數量遞增）', () => {
    const w = diffState(base({ tables: { B5: session() } }), base({ tables: { B5: session({ lines: [line({ qty: 3 })] }) } }));
    expect(w).toEqual([
      {
        path: ['tables', 'B5'],
        write: {
          kind: 'merge',
          ops: [
            { op: 'set', path: ['lines', 'r-02', 'menuItemId'], value: 'r-02' },
            { op: 'set', path: ['lines', 'r-02', 'name'], value: '夜未央' },
            { op: 'set', path: ['lines', 'r-02', 'addedAt'], value: 1000 },
            { op: 'set', path: ['lines', 'r-02', 'tags'], value: [] },
            { op: 'set', path: ['lines', 'r-02', 'note'], value: '' },
            { op: 'inc', path: ['lines', 'r-02', 'qty'], by: 2 },
          ],
        },
      },
    ]);
  });

  it('歷史、酒單：新增或變更 → 整份寫入；移除 → 刪除', () => {
    const h = { ...session(), id: 'h1', closedAt: 2, dayId: 'd-1', dayStartedAt: 1 };
    const m = { id: 'c-01', categoryId: 'classic' as const, name: 'X', price: 1, sort: 0, active: true };
    expect(diffState(base(), base({ history: { h1: h }, menu: { 'c-01': m } }))).toEqual([
      { path: ['history', 'h1'], write: { kind: 'set', data: h } },
      { path: ['menu', 'c-01'], write: { kind: 'set', data: m } },
    ]);
    expect(diffState(base({ history: { h1: h } }), base())).toEqual([{ path: ['history', 'h1'], write: { kind: 'delete' } }]);
  });

  it('營業日與設定存在 meta 文件', () => {
    const day = { id: 'd-1', startedAt: 1 };
    expect(diffState(base(), base({ day, settings: { accessKey: 'k' } }))).toEqual([
      { path: ['meta', 'business'], write: { kind: 'set', data: { day, lastEnd: null } } },
      { path: ['meta', 'settings'], write: { kind: 'set', data: { accessKey: 'k' } } },
    ]);
  });

  it('沒有變化 → 不寫', () => {
    expect(diffState(base({ tables: { B5: session() } }), base({ tables: { B5: session() } }))).toEqual([]);
  });
});
