import { useState } from 'react';
import { historyByDay, type BarState } from '../../domain/bar';
import { cupCount } from '../../domain/session';
import { dayLabel, errorText, hhmm, notesText } from '../format';

export function History(props: { state: BarState; onBack: () => void; onRestore: (id: string) => Promise<void> }) {
  const [error, setError] = useState('');
  const groups = historyByDay(props.state);
  return (
    <main className="screen">
      <header className="bar">
        <button className="link" onClick={props.onBack}>← 桌位</button>
        <h1>歷史</h1>
      </header>
      {error && <p role="alert" className="alert">{error}</p>}
      {groups.length === 0 && <p className="empty">目前沒有已清桌的紀錄</p>}
      {groups.map((g) => (
        <section key={g.day.id} aria-label={`${dayLabel(g.day.startedAt)} 營業日`} className="zone">
          <h2>{dayLabel(g.day.startedAt)} 營業日 · {g.sessions.length} 桌次</h2>
          {g.sessions.map((h) => (
            <article key={h.id} aria-label={`${h.tableId} ${hhmm(h.openedAt)}–${hhmm(h.closedAt)}`} className="card">
              <header>
                <strong>{h.tableId}</strong>
                <span className="muted">{hhmm(h.openedAt)}–{hhmm(h.closedAt)} · {cupCount(h)} 杯</span>
                {h.recovered && <span className="flag">離線補傳</span>}
              </header>
              {h.note && <p className="card-note">{h.note}</p>}
              <ul>
                {h.lines.map((l) => (
                  <li key={l.lineId}>
                    <span>{l.name}{notesText(l) && <em>｜{notesText(l)}</em>}</span>
                    <span className="qty">×{l.qty}</span>
                  </li>
                ))}
              </ul>
              <button
                className="ghost small"
                aria-label={`還原到 ${h.tableId}`}
                onClick={() => props.onRestore(h.id).then(() => setError(''), (e) => setError(errorText(e)))}
              >
                還原
              </button>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
