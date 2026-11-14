import { describe, it, expect } from 'vitest';
import { TABLES } from './tables';
import { MENU, CATEGORIES, activeItemsOf } from './menu';
import { addItem, cupCount, statusOf } from './session';

describe('桌位', () => {
  it('共 29 桌：B1–B20、C1–C9，依區域與號碼排序', () => {
    expect(TABLES).toHaveLength(29);
    const b = TABLES.filter((t) => t.zone === 'B').map((t) => t.id);
    const c = TABLES.filter((t) => t.zone === 'C').map((t) => t.id);
    expect(b).toEqual(Array.from({ length: 20 }, (_, i) => `B${i + 1}`));
    expect(c).toEqual(Array.from({ length: 9 }, (_, i) => `C${i + 1}`));
  });
});

describe('酒單', () => {
  it('只有三個調酒分類', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['classic', 'reviver', 'guest']);
  });

  it('含照片上的調酒，且皆為上架狀態', () => {
    const names = MENU.map((m) => m.name);
    for (const n of ['Old Fashioned', 'Penicillin', '穀雨', '夜未央', '否認（長島冰茶）', '續風']) {
      expect(names).toContain(n);
    }
    expect(MENU.length).toBeGreaterThanOrEqual(38);
    expect(MENU.every((m) => m.active)).toBe(true);
  });

  it('不含非調酒品項', () => {
    const names = MENU.map((m) => m.name).join(',');
    for (const banned of ['台啤', '1664', 'Shot', '芭樂汁', '鏢機', '買一送一']) {
      expect(names).not.toContain(banned);
    }
  });

  it('品項 id 不重複', () => {
    const ids = MENU.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('activeItemsOf 依 sort 排序並排除下架品項', () => {
    const items = activeItemsOf('reviver', [
      { id: 'x', categoryId: 'reviver', name: 'X', price: 1, sort: 2, active: true },
      { id: 'y', categoryId: 'reviver', name: 'Y', price: 1, sort: 1, active: true },
      { id: 'z', categoryId: 'reviver', name: 'Z', price: 1, sort: 0, active: false },
      { id: 'w', categoryId: 'classic', name: 'W', price: 1, sort: 0, active: true },
    ]);
    expect(items.map((i) => i.id)).toEqual(['y', 'x']);
  });
});

describe('桌次：加酒', () => {
  const yewei = { id: 'r-yeweiyang', name: '夜未央' };
  const ny = { id: 'c-new-york-sour', name: 'New York Sour' };

  it('空桌狀態為 empty、杯數 0', () => {
    expect(statusOf(undefined)).toBe('empty');
    expect(cupCount(undefined)).toBe(0);
  });

  it('空桌加第一杯 → 開新桌次、記下開桌時間、變 occupied', () => {
    const s = addItem(undefined, 'B5', yewei, 1000);
    expect(s.tableId).toBe('B5');
    expect(s.openedAt).toBe(1000);
    expect(statusOf(s)).toBe('occupied');
    expect(s.lines).toEqual([
      { lineId: 'r-yeweiyang', menuItemId: 'r-yeweiyang', name: '夜未央', qty: 1, addedAt: 1000, tags: [], note: '' },
    ]);
    expect(s.note).toBe('');
  });

  it('同一杯連點 → 數量累加，不新增行、開桌時間不變', () => {
    let s = addItem(undefined, 'B5', yewei, 1000);
    s = addItem(s, 'B5', yewei, 2000);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].qty).toBe(2);
    expect(s.openedAt).toBe(1000);
  });

  it('不同酒 → 依加入時間各一行，杯數為總和', () => {
    let s = addItem(undefined, 'B5', yewei, 1000);
    s = addItem(s, 'B5', ny, 2000);
    s = addItem(s, 'B5', yewei, 3000);
    expect(s.lines.map((l) => l.name)).toEqual(['夜未央', 'New York Sour']);
    expect(cupCount(s)).toBe(3);
  });

  it('不改動傳入的原物件（不可變）', () => {
    const s1 = addItem(undefined, 'B5', yewei, 1000);
    const snapshot = JSON.stringify(s1);
    addItem(s1, 'B5', yewei, 2000);
    expect(JSON.stringify(s1)).toBe(snapshot);
  });

  it('桌號不符時拒絕', () => {
    const s = addItem(undefined, 'B5', yewei, 1000);
    expect(() => addItem(s, 'C1', yewei, 2000)).toThrow();
  });
});
