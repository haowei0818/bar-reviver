import { useEffect, useState } from 'react';
import { cupCount, type TableSession } from '../../domain/session';
import { hhmm, lineLabel, notesText } from '../format';
import { ConfirmDialog } from './ConfirmDialog';

export function TableDetail(props: {
  tableId: string;
  session?: TableSession;
  onBack: () => void;
  onAdd: () => void;
  onQty: (lineId: string, delta: number) => void;
  onEditNotes: (lineId: string) => void;
  onSaveTableNote: (note: string) => void;
  onClear: () => void;
}) {
  const { tableId, session, onBack, onAdd, onQty, onEditNotes, onSaveTableNote, onClear } = props;
  const [confirming, setConfirming] = useState(false);
  return (
    <main className="screen">
      <header className="bar">
        <button className="link" onClick={onBack}>← 桌位</button>
        <h1>{tableId}</h1>
        <span className="muted">{session ? `${hhmm(session.openedAt)} 開桌 · ${cupCount(session)} 杯` : '空桌'}</span>
        {session && <button className="ghost small" onClick={() => setConfirming(true)}>清桌</button>}
      </header>
      {session?.recovered && (
        <p className="alert">離線補傳：這桌在別支手機已清桌，請確認是否為同一組客人</p>
      )}
      <TableNote key={tableId} saved={session?.note ?? ''} onSave={onSaveTableNote} />
      {session && session.lines.length > 0 ? (
        <ul className="lines">
          {session.lines.map((l) => (
            <li key={l.lineId} aria-label={lineLabel(l)}>
              <button className="line-main" aria-label={`編輯備註 ${lineLabel(l)}`} onClick={() => onEditNotes(l.lineId)}>
                <span className="line-name">{l.name}</span>
                {notesText(l) ? <span className="line-notes">{notesText(l)}</span> : <span className="line-hint">＋ 備註</span>}
              </button>
              <div className="stepper">
                <button aria-label={`${lineLabel(l)} 減一杯`} onClick={() => onQty(l.lineId, -1)}>−</button>
                <span className="qty">×{l.qty}</span>
                <button aria-label={`${lineLabel(l)} 加一杯`} onClick={() => onQty(l.lineId, +1)}>＋</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">尚未點酒</p>
      )}
      <footer className="actions">
        <button className="primary" onClick={onAdd}>＋ 加酒</button>
      </footer>
      {confirming && session && (
        <ConfirmDialog
          title={`清桌 ${tableId}？`}
          confirmLabel="確定清桌"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onClear();
          }}
        >
          <p className="muted">{cupCount(session)} 杯的紀錄會移到歷史，之後可以還原。</p>
        </ConfirmDialog>
      )}
    </main>
  );
}

function TableNote({ saved, onSave }: { saved: string; onSave: (note: string) => void }) {
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const dirty = draft.trim() !== saved;
  return (
    <section className="table-note">
      <textarea
        aria-label="桌備註"
        placeholder="桌備註（分開結帳、壽星…）"
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {dirty && <button className="primary small" onClick={() => onSave(draft)}>儲存桌備註</button>}
    </section>
  );
}
