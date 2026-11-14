import type { TableRepo } from './repo';
import { createLocalRepo } from './localRepo';

export type RepoMode = 'cloud' | 'local';

function firebaseConfig() {
  const e = import.meta.env;
  if (!e.VITE_FIREBASE_API_KEY || !e.VITE_FIREBASE_PROJECT_ID) return null;
  return {
    apiKey: e.VITE_FIREBASE_API_KEY,
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: e.VITE_FIREBASE_PROJECT_ID,
    appId: e.VITE_FIREBASE_APP_ID,
  };
}

/** 有 Firebase 設定 → 雲端同步；沒有 → 本機試用模式 */
export async function createRepo(): Promise<{ repo: TableRepo; mode: RepoMode }> {
  const cfg = firebaseConfig();
  if (!cfg) return { repo: createLocalRepo(localStorage), mode: 'local' };
  const { createFirestoreRepo } = await import('./firestoreRepo');
  return { repo: createFirestoreRepo(cfg), mode: 'cloud' };
}
