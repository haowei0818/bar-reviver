import { emptyState, type BarState } from '../domain/bar';
import type { BarRepo } from './repo';
import { newId, repoFrom } from './commands';

const KEY = 'bar-reviver:state:v2';
const V1 = 'bar-reviver:sessions:v1';

/** 存在瀏覽器 localStorage 的資料層：未設定 Firebase 時的試用模式（不跨裝置） */
export function createLocalRepo(
  storage: Storage,
  now: () => number = Date.now,
  genId: () => string = newId,
): BarRepo {
  const listeners = new Set<(s: BarState) => void>();
  const load = (): BarState => {
    try {
      const raw = storage.getItem(KEY);
      if (raw) return { ...emptyState(), ...JSON.parse(raw) };
      const v1 = storage.getItem(V1); // T1 試用資料搬移
      return v1 ? { ...emptyState(), tables: JSON.parse(v1) } : emptyState();
    } catch {
      return emptyState();
    }
  };
  return repoFrom(
    {
      subscribe(cb) {
        listeners.add(cb);
        cb(load());
        // T3：同一台裝置的其他分頁寫入時，瀏覽器會發出 storage 事件
        const onStorage = (e: StorageEvent) => {
          if (e.key === KEY) cb(load());
        };
        window.addEventListener('storage', onStorage);
        return () => {
          listeners.delete(cb);
          window.removeEventListener('storage', onStorage);
        };
      },
      async transact(fn) {
        const next = fn(load());
        storage.setItem(KEY, JSON.stringify(next));
        listeners.forEach((cb) => cb(next));
      },
    },
    now,
    genId,
  );
}
