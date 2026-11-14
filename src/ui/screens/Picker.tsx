import { useState } from 'react';
import { CATEGORIES, activeItemsOf, type CategoryId, type MenuItem } from '../../domain/menu';
import type { TableSession } from '../../domain/session';

export function Picker(props: {
  tableId: string;
  menu: MenuItem[];
  session?: TableSession;
  onPick: (item: { id: string; name: string }) => void;
  onDone: () => void;
}) {
  const { tableId, menu, session, onPick, onDone } = props;
  const [cat, setCat] = useState<CategoryId>('classic');
  const items = activeItemsOf(cat, menu);
  const qtyOf = (id: string) => session?.lines.filter((l) => l.menuItemId === id).reduce((n, l) => n + l.qty, 0) ?? 0;
  return (
    <main className="screen">
      <header className="bar">
        <h1>{tableId} 加酒</h1>
        <button className="primary small" onClick={onDone}>完成</button>
      </header>
      <div role="tablist" className="tabs">
        {CATEGORIES.map((c) => (
          <button key={c.id} role="tab" aria-selected={c.id === cat} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="empty">目前沒有上架品項</p>
      ) : (
        <div className="menu">
          {items.map((m) => (
            <button key={m.id} className="item" onClick={() => onPick(m)}>
              <span className="name">{m.name}</span>
              {m.price !== null && <span className="price">${m.price}</span>}
              {qtyOf(m.id) > 0 && <span className="badge">已點 {qtyOf(m.id)}</span>}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
