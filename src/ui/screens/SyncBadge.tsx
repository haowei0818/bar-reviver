import type { SyncStatus } from '../../data/repo';

/** 雲端模式的連線狀態；一切正常時不顯示 */
export function SyncBadge({ sync }: { sync: SyncStatus | null }) {
  if (!sync || (sync.online && sync.pendingDocs === 0)) return null;
  const text = !sync.online
    ? sync.pendingDocs > 0
      ? `離線中，${sync.pendingDocs} 筆待同步`
      : '離線中，記錄會在連線後自動上傳'
    : '同步中…';
  return (
    <div role="status" aria-label="同步狀態" className={`sync ${sync.online ? '' : 'offline'}`}>
      {text}
    </div>
  );
}
