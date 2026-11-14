import { describe, it, expect, vi } from 'vitest';
import { createLocalRepo } from './localRepo';
import { diff, toSession, type FieldOp, type TableDoc } from './firestoreMapping';
import { addItem } from '../domain/session';

/** 模擬 Firestore set(merge) 套用欄位操作到一份文件 */
function applyOps(docIn: Record<string, unknown> | undefined, ops: FieldOp[]) {
  const doc = structuredClone(docIn ?? {}) as Record<string, unknown>;
  for (const o of ops) {
    let cur = doc;
    o.path.slice(0, -1).forEach((k) => (cur = (cur[k] ??= {}) as Record<string, unknown>));
    const last = o.path.at(-1)!;
    if (o.op === 'set') cur[last] = o.value;
    if (o.op === 'inc') cur[last] = ((cur[last] as number) ?? 0) + o.by;
    if (o.op === 'del') delete cur[last];
  }
  return doc as TableDoc;
}

const yewei = { id: 'r-02', name: '夜未央' };

describe('T7：A 清桌、B 離線加酒', () => {
  it('B 連線後，那杯酒不會遺失，出現在重建的桌次並標示「離線補傳」', () => {
    const bView = addItem(undefined, 'B5', yewei, 1000); // B 離線前看到的桌況
    const bNext = addItem(bView, 'B5', yewei, 2000); // B 離線時再加一杯
    const w = diff(bView, bNext);
    expect(w.kind).toBe('merge');
    // A 已清桌 → 雲端文件已刪除；B 的寫入套用到空文件
    const merged = applyOps(undefined, w.kind === 'merge' ? w.ops : []);
    const s = toSession('B5', merged)!;
    expect(s).toBeDefined();
    expect(s.lines).toMatchObject([{ name: '夜未央', qty: 1 }]);
    expect(s.recovered).toBe(true);
  });

  it('正常情況（文件還在）同時加酒不互相覆蓋', () => {
    const base = addItem(undefined, 'B5', yewei, 1000);
    const cloud = applyOps(undefined, (diff(undefined, base) as { ops: FieldOp[] }).ops);
    const a = diff(base, addItem(base, 'B5', yewei, 2000));
    const b = diff(base, addItem(base, 'B5', yewei, 2001));
    const merged = applyOps(applyOps(cloud, (a as { ops: FieldOp[] }).ops), (b as { ops: FieldOp[] }).ops);
    const s = toSession('B5', merged)!;
    expect(s.lines[0].qty).toBe(3);
    expect(s.recovered).toBeUndefined();
  });
});

describe('T3：本機試用模式也能跨分頁同步', () => {
  it('另一個分頁寫入後，這個分頁收到更新', async () => {
    const a = createLocalRepo(localStorage, () => 1000);
    const b = createLocalRepo(localStorage, () => 1000);
    const cb = vi.fn();
    const off = b.subscribe(cb);
    await a.addItem('B5', yewei);
    // 瀏覽器只會對「其他分頁」發出 storage 事件，這裡手動模擬
    window.dispatchEvent(new StorageEvent('storage', { key: 'bar-reviver:state:v2' }));
    expect(cb.mock.calls.at(-1)![0].tables.B5.lines[0].name).toBe('夜未央');
    off();
  });
});
