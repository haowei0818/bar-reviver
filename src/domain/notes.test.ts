import { describe, it, expect } from 'vitest';
import { addItem, changeQty, setLineNotes, setTableNote, statusOf, cupCount, QUICK_TAGS, type TableSession } from './session';

const yewei = { id: 'r-02', name: '夜未央' };
const of = { id: 'c-08', name: 'Old Fashioned' };
const T = 'B5';

const twoYewei = (): TableSession => addItem(addItem(undefined, T, yewei, 1000), T, yewei, 1100);

describe('快速鍵', () => {
  it('固定五個', () => {
    expect(QUICK_TAGS).toEqual(['少甜', '少冰', '去冰', '加濃', '不要酒精']);
  });
});

describe('每杯備註', () => {
  it('對整行加備註：保留數量，該行不再接收無備註的加點', () => {
    let s = twoYewei();
    const lineId = s.lines[0].lineId;
    s = setLineNotes(s, lineId, { tags: ['少甜'], note: '' }, 2, 'n1', 2000);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ qty: 2, tags: ['少甜'], note: '' });

    s = addItem(s, T, yewei, 3000);
    expect(s.lines.map((l) => [l.qty, l.tags])).toEqual([[2, ['少甜']], [1, []]]);
  });

  it('只套用到 1 杯：拆成兩行（夜未央 ×1、夜未央 ×1｜少甜）', () => {
    let s = twoYewei();
    s = setLineNotes(s, s.lines[0].lineId, { tags: ['少甜'], note: '' }, 1, 'n1', 2000);
    expect(s.lines.map((l) => ({ qty: l.qty, tags: l.tags }))).toEqual([
      { qty: 1, tags: [] },
      { qty: 1, tags: ['少甜'] },
    ]);
    expect(s.lines[1].lineId).toBe('n1');
    expect(cupCount(s)).toBe(2);
  });

  it('快速鍵可複選，並可加自由文字；快速鍵依固定順序、去重', () => {
    let s = addItem(undefined, T, of, 1000);
    s = setLineNotes(s, s.lines[0].lineId, { tags: ['少冰', '少甜', '少甜'], note: ' 換波本 ' }, 1, 'n1', 2000);
    expect(s.lines[0]).toMatchObject({ tags: ['少甜', '少冰'], note: '換波本' });
  });

  it('清空備註：併回同酒的無備註行', () => {
    let s = twoYewei();
    s = setLineNotes(s, s.lines[0].lineId, { tags: ['少甜'], note: '' }, 1, 'n1', 2000);
    s = setLineNotes(s, 'n1', { tags: [], note: '' }, 1, 'n2', 3000);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ qty: 2, tags: [], note: '' });
  });

  it('清空備註且沒有無備註行：該行改回無備註行（之後加點會累加到它）', () => {
    let s = addItem(undefined, T, yewei, 1000);
    s = setLineNotes(s, s.lines[0].lineId, { tags: ['加濃'], note: '' }, 1, 'n1', 2000);
    s = setLineNotes(s, s.lines[0].lineId, { tags: [], note: '' }, 1, 'n2', 3000);
    s = addItem(s, T, yewei, 4000);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].qty).toBe(2);
  });

  it('套用杯數超出範圍時拒絕', () => {
    const s = twoYewei();
    expect(() => setLineNotes(s, s.lines[0].lineId, { tags: ['少甜'], note: '' }, 3, 'n1', 2000)).toThrow();
    expect(() => setLineNotes(s, s.lines[0].lineId, { tags: ['少甜'], note: '' }, 0, 'n1', 2000)).toThrow();
  });

  it('不存在的 lineId 拒絕', () => {
    expect(() => setLineNotes(twoYewei(), 'nope', { tags: [], note: '' }, 1, 'n1', 2000)).toThrow();
  });
});

describe('數量增減', () => {
  it('+1 / −1', () => {
    let s = twoYewei();
    const id = s.lines[0].lineId;
    s = changeQty(s, id, +1)!;
    expect(s.lines[0].qty).toBe(3);
    s = changeQty(s, id, -1)!;
    expect(s.lines[0].qty).toBe(2);
  });

  it('減到 0 即刪除該行', () => {
    let s = addItem(addItem(undefined, T, yewei, 1000), T, of, 1100);
    s = changeQty(s, s.lines[0].lineId, -1)!;
    expect(s.lines.map((l) => l.name)).toEqual(['Old Fashioned']);
  });

  it('最後一杯減到 0 且沒有桌備註 → 變回空桌（undefined）', () => {
    const s = addItem(undefined, T, yewei, 1000);
    expect(changeQty(s, s.lines[0].lineId, -1)).toBeUndefined();
  });

  it('最後一杯減到 0 但有桌備註 → 仍使用中', () => {
    let s = setTableNote(addItem(undefined, T, yewei, 1000), T, '壽星', 1100)!;
    s = changeQty(s, s.lines[0].lineId, -1)!;
    expect(statusOf(s)).toBe('occupied');
    expect(s.lines).toEqual([]);
  });
});

describe('桌備註', () => {
  it('空桌只寫桌備註 → 開桌次、使用中、開桌時間為寫入時間', () => {
    const s = setTableNote(undefined, T, '分開結帳', 5000)!;
    expect(s).toMatchObject({ tableId: T, openedAt: 5000, note: '分開結帳', lines: [] });
    expect(statusOf(s)).toBe('occupied');
  });

  it('修改桌備註不改開桌時間', () => {
    let s = addItem(undefined, T, yewei, 1000);
    s = setTableNote(s, T, '靠窗壽星', 9000)!;
    expect(s.openedAt).toBe(1000);
    expect(s.note).toBe('靠窗壽星');
  });

  it('沒有酒時清空桌備註 → 變回空桌', () => {
    const s = setTableNote(undefined, T, '分開結帳', 5000)!;
    expect(setTableNote(s, T, '   ', 6000)).toBeUndefined();
  });
});
