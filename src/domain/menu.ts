export type CategoryId = 'classic' | 'reviver' | 'guest';
export type MenuItem = {
  id: string;
  categoryId: CategoryId;
  name: string;
  /** 參考價，僅顯示；null = 待補 */
  price: number | null;
  sort: number;
  active: boolean;
};

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'classic', label: 'CLASSIC' },
  { id: 'reviver', label: 'REVIVER 調酒' },
  { id: 'guest', label: '客座' },
];

type Seed = [name: string, price: number | null];

const CLASSIC: Seed[] = [
  ['Hot Toddy', 380], ['Hunter', 400], ['John Collins', 380], ["King's Valley", 400],
  ['Manhattan', 400], ['Mint Julep', 380], ['New York Sour', 380], ['Old Fashioned', 380],
  ['Old Pal', 380], ['Paper Plane', 400], ['Penicillin', 380], ['Robroy', null],
];

// 穀雨：POS 標價 $0，店家確認為品項（2026-11-14）
const REVIVER: Seed[] = [
  ['穀雨', 0], ['夜未央', 350], ['清晰', 350], ['慢半拍', 350], ['望穿秋水', 350], ['甦醒', 350],
  ['再多就壞了', 350], ['這不是現在', 350], ['禁果', 350], ['無誠勿愛', 350], ['山風寄', 350],
  ['露餡 2.0', 350], ['秋霧', 350], ['有人在嗎？', 350], ['沒有座標的人', 350], ['差不多好了', 350],
  ['放空', 350], ['日光棉', 380], ['氣泡裡的記憶', 380],
  ['否認（長島冰茶）', 400], ['耐受性（東京冰茶）', 400], ['失控（邁阿密冰茶）', 400],
  ['依賴（加州冰茶）', 400], ['復發（環遊世界）', 400], ['翠風', 280], ['續風', 280],
];

const build = (categoryId: CategoryId, prefix: string, seeds: Seed[]): MenuItem[] =>
  seeds.map(([name, price], i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    categoryId,
    name,
    price,
    sort: i,
    active: true,
  }));

/** 初始酒單（2026-11-14 POS 照片），T6 後台上線後改由資料庫維護 */
export const MENU: MenuItem[] = [...build('classic', 'c', CLASSIC), ...build('reviver', 'r', REVIVER)];

export function activeItemsOf(categoryId: CategoryId, items: MenuItem[]): MenuItem[] {
  return items
    .filter((i) => i.categoryId === categoryId && i.active)
    .sort((a, b) => a.sort - b.sort);
}

// ---- T6 酒單維護（店長後台）----

/** 資料庫中的酒單；空物件 = 尚未自訂，沿用初始酒單 */
export type MenuMap = Record<string, MenuItem>;

export function menuOf(stored: MenuMap): MenuItem[] {
  const items = Object.values(stored);
  return items.length ? items : MENU;
}

/** 第一次修改時把初始酒單整份帶入，之後以資料庫為準 */
const materialize = (stored: MenuMap): MenuMap =>
  Object.keys(stored).length ? { ...stored } : Object.fromEntries(MENU.map((m) => [m.id, { ...m }]));

function assertName(all: MenuMap, categoryId: CategoryId, name: string, selfId?: string) {
  if (!name) throw new Error('名稱不能空白');
  const dup = Object.values(all).find((m) => m.categoryId === categoryId && m.active && m.name === name && m.id !== selfId);
  if (dup) throw new Error(`這個分類已有「${name}」`);
}

export function addMenuItem(
  stored: MenuMap,
  input: { categoryId: CategoryId; name: string; price: number | null },
  id: string,
): MenuMap {
  const all = materialize(stored);
  const name = input.name.trim();
  assertName(all, input.categoryId, name);
  const sorts = Object.values(all).filter((m) => m.categoryId === input.categoryId).map((m) => m.sort);
  const sort = sorts.length ? Math.max(...sorts) + 1 : 0;
  return { ...all, [id]: { id, categoryId: input.categoryId, name, price: input.price, sort, active: true } };
}

export function updateMenuItem(
  stored: MenuMap,
  id: string,
  patch: Partial<Pick<MenuItem, 'name' | 'price' | 'active'>>,
): MenuMap {
  const all = materialize(stored);
  const cur = all[id];
  if (!cur) throw new Error('找不到這個品項');
  const next = { ...cur, ...patch, name: (patch.name ?? cur.name).trim() };
  if (patch.name !== undefined || (patch.active && !cur.active)) assertName(all, next.categoryId, next.name, id);
  return { ...all, [id]: next };
}

/** 與同分類相鄰的品項互換排序；到頂或到底不動 */
export function moveMenuItem(stored: MenuMap, id: string, dir: -1 | 1): MenuMap {
  const all = materialize(stored);
  const cur = all[id];
  if (!cur) throw new Error('找不到這個品項');
  const siblings = Object.values(all)
    .filter((m) => m.categoryId === cur.categoryId)
    .sort((a, b) => a.sort - b.sort);
  const i = siblings.findIndex((m) => m.id === id);
  const other = siblings[i + dir];
  if (!other) return all;
  return { ...all, [id]: { ...cur, sort: other.sort }, [other.id]: { ...other, sort: cur.sort } };
}
