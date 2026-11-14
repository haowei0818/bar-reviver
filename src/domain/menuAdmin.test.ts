import { describe, it, expect } from 'vitest';
import { MENU, menuOf, addMenuItem, updateMenuItem, moveMenuItem, activeItemsOf } from './menu';

describe('T6 酒單維護', () => {
  it('尚未自訂時使用初始酒單', () => {
    expect(menuOf({})).toEqual(MENU);
  });

  it('第一次修改會把初始酒單整份寫入，之後以資料庫為準', () => {
    const stored = updateMenuItem({}, 'c-05', { active: false });
    expect(Object.keys(stored)).toHaveLength(MENU.length);
    expect(stored['c-05'].active).toBe(false);
    expect(menuOf(stored).find((m) => m.id === 'c-05')!.active).toBe(false);
  });

  it('新增：排在該分類最後、預設上架；名稱前後空白去除', () => {
    const stored = addMenuItem({}, { categoryId: 'guest', name: ' 阿廖特調 ', price: 420 }, 'g-1');
    expect(stored['g-1']).toEqual({ id: 'g-1', categoryId: 'guest', name: '阿廖特調', price: 420, sort: 0, active: true });
    const more = addMenuItem(stored, { categoryId: 'guest', name: '第二杯', price: null }, 'g-2');
    expect(more['g-2'].sort).toBe(1);
  });

  it('名稱空白拒絕；同分類已有同名上架品項拒絕', () => {
    expect(() => addMenuItem({}, { categoryId: 'guest', name: '  ', price: null }, 'x')).toThrow('名稱');
    expect(() => addMenuItem({}, { categoryId: 'classic', name: 'Manhattan', price: 400 }, 'x')).toThrow('已有');
    expect(() => updateMenuItem({}, 'c-01', { name: 'Manhattan' })).toThrow('已有');
  });

  it('改名、改參考價', () => {
    const s = updateMenuItem({}, 'c-08', { name: 'Old Fashioned（波本）', price: 420 });
    expect(s['c-08']).toMatchObject({ name: 'Old Fashioned（波本）', price: 420 });
  });

  it('排序：與同分類相鄰品項互換；到頂或到底不動', () => {
    let s = moveMenuItem({}, 'c-02', -1); // Hunter 往上
    expect(activeItemsOf('classic', menuOf(s)).slice(0, 2).map((m) => m.name)).toEqual(['Hunter', 'Hot Toddy']);
    s = moveMenuItem(s, 'c-02', -1);
    expect(activeItemsOf('classic', menuOf(s))[0].name).toBe('Hunter');
    const last = activeItemsOf('reviver', MENU).at(-1)!;
    expect(activeItemsOf('reviver', menuOf(moveMenuItem({}, last.id, +1))).at(-1)!.id).toBe(last.id);
  });

  it('不存在的品項拒絕', () => {
    expect(() => updateMenuItem({}, 'nope', { active: false })).toThrow();
  });
});
