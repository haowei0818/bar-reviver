import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  collection,
  doc,
  onSnapshot,
  writeBatch,
  increment,
  deleteField,
  type Firestore,
  type QuerySnapshot,
  type SnapshotListenOptions,
} from 'firebase/firestore';
import { emptyState, type BarState } from '../domain/bar';
import type { BarRepo, SyncStatus } from './repo';
import { diffState, toSession, type FieldOp, type TableDoc } from './firestoreMapping';
import { newId, repoFrom } from './commands';

/** 把欄位操作轉成 set(merge) 用的巢狀物件 */
function toNested(ops: FieldOp[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const o of ops) {
    let cur = root;
    o.path.slice(0, -1).forEach((k) => {
      cur = (cur[k] ??= {}) as Record<string, unknown>;
    });
    const last = o.path[o.path.length - 1];
    cur[last] = o.op === 'set' ? o.value : o.op === 'inc' ? increment(o.by) : deleteField();
  }
  return root;
}

/** 薄轉接層：判斷邏輯都在 domain 與 firestoreMapping（已測試），這裡只負責讀寫 */
export function createFirestoreRepo(
  options: FirebaseOptions,
  now: () => number = Date.now,
): BarRepo & { db: Firestore } {
  const app = initializeApp(options);
  const db = initializeFirestore(app, { localCache: persistentLocalCache() });
  let latest: BarState = emptyState();
  const listeners = new Set<(s: BarState) => void>();
  const syncListeners = new Set<(s: SyncStatus) => void>();
  const pending = new Map<string, number>(); // 各集合尚未上傳的文件數
  const loaded = new Set<string>();
  let error: string | undefined;
  let started = false;

  const emit = () => {
    if (loaded.size < 4) return; // 四個來源都載入後才通知，避免畫面閃爍
    listeners.forEach((cb) => cb(latest));
  };
  const emitSync = () => {
    const s: SyncStatus = { online: navigator.onLine, pendingDocs: [...pending.values()].reduce((a, b) => a + b, 0), error };
    syncListeners.forEach((cb) => cb(s));
  };

  function start() {
    if (started) return;
    started = true;
    const opts: SnapshotListenOptions = { includeMetadataChanges: true };
    // 讀取失敗時（例如資料庫規則拒絕）仍讓畫面出現，並顯示原因
    const onError = (name: string) => (e: { code?: string; message: string }) => {
      error = e.code === 'permission-denied' ? '資料庫拒絕存取（權限不足），請聯絡店長' : `資料庫連線錯誤：${e.message}`;
      loaded.add(name);
      emit();
      emitSync();
    };
    onSnapshot(collection(db, 'tables'), opts, (snap: QuerySnapshot) => {
      const tables: BarState['tables'] = {};
      snap.forEach((d) => {
        const s = toSession(d.id, d.data() as TableDoc);
        if (s) tables[d.id] = s;
      });
      latest = { ...latest, tables };
      pending.set('tables', snap.docs.filter((d) => d.metadata.hasPendingWrites).length);
      loaded.add('tables');
      emit();
      emitSync();
    }, onError('tables'));
    for (const col of ['history', 'menu'] as const) {
      onSnapshot(collection(db, col), opts, (snap: QuerySnapshot) => {
        const map: Record<string, unknown> = {};
        snap.forEach((d) => (map[d.id] = d.data()));
        latest = { ...latest, [col]: map };
        pending.set(col, snap.docs.filter((d) => d.metadata.hasPendingWrites).length);
        loaded.add(col);
        emit();
        emitSync();
      }, onError(col));
    }
    onSnapshot(collection(db, 'meta'), opts, (snap: QuerySnapshot) => {
      const business = snap.docs.find((d) => d.id === 'business')?.data();
      const settings = snap.docs.find((d) => d.id === 'settings')?.data();
      latest = {
        ...latest,
        day: (business?.day as BarState['day']) ?? null,
        lastEnd: (business?.lastEnd as BarState['lastEnd']) ?? null,
        settings: (settings as BarState['settings']) ?? { accessKey: null },
      };
      pending.set('meta', snap.docs.filter((d) => d.metadata.hasPendingWrites).length);
      loaded.add('meta');
      emit();
      emitSync();
    }, onError('meta'));
    window.addEventListener('online', emitSync);
    window.addEventListener('offline', emitSync);
  }

  const repo = repoFrom(
    {
      subscribe(cb) {
        listeners.add(cb);
        start();
        if (loaded.size >= 4) cb(latest);
        return () => listeners.delete(cb);
      },
      async transact(fn) {
        const patches = diffState(latest, fn(latest));
        if (patches.length === 0) return;
        const batch = writeBatch(db);
        for (const { path, write } of patches) {
          const ref = doc(db, path[0], path[1]);
          if (write.kind === 'delete') batch.delete(ref);
          else if (write.kind === 'set') batch.set(ref, write.data as Record<string, unknown>);
          else if (write.kind === 'merge') batch.set(ref, toNested(write.ops), { merge: true });
        }
        // 不 await：離線時寫入先進本機快取，畫面立即更新，連線後自動上傳
        void batch.commit();
      },
    },
    now,
    newId,
  );
  return {
    ...repo,
    db,
    onSync(cb) {
      syncListeners.add(cb);
      start();
      return () => syncListeners.delete(cb);
    },
  };
}
