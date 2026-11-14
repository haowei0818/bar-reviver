import type { ReactNode } from 'react';
import type { Sessions } from '../../data/repo';
import { TABLES, type Zone } from '../../domain/tables';
import { cupCount, statusOf } from '../../domain/session';
import { hhmm } from '../format';

export function Overview(props: { sessions: Sessions; onOpen: (id: string) => void; nav: ReactNode; banner?: ReactNode }) {
  const { sessions, onOpen } = props;
  const zones: Zone[] = ['B', 'C'];
  const occupied = Object.values(sessions).filter((s) => statusOf(s) === 'occupied').length;
  return (
    <main className="screen">
      <header className="bar">
        <h1>Bar Reviver</h1>
        <span className="muted">使用中 {occupied} / {TABLES.length}</span>
      </header>
      <nav className="nav">{props.nav}</nav>
      {props.banner}
      {zones.map((z) => (
        <section key={z} aria-label={`${z} 區`} className="zone">
          <h2>{z} 區</h2>
          <div className="grid">
            {TABLES.filter((t) => t.zone === z).map((t) => {
              const s = sessions[t.id];
              const busy = statusOf(s) === 'occupied';
              const label = busy
                ? `${t.id} 使用中 ${cupCount(s)} 杯 ${hhmm(s!.openedAt)} 開桌${s!.note ? ' 有桌備註' : ''}${s!.recovered ? ' 離線補傳' : ''}`
                : `${t.id} 空桌`;
              return (
                <button key={t.id} aria-label={label} className={`table ${busy ? 'busy' : ''}`} onClick={() => onOpen(t.id)}>
                  <strong>{t.id}</strong>
                  {busy && (
                    <>
                      <span className="cups">{cupCount(s)} 杯</span>
                      <span className="since">{hhmm(s!.openedAt)}</span>
                      {s!.note && <span className="flag">備註</span>}
                      {s!.recovered && <span className="flag warn">補傳</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
