import { useState } from 'react';
import { CATEGORIES, type CategoryId, type MenuItem } from '../../domain/menu';
import type { BarRepo } from '../../data/repo';
import { errorText } from '../format';

const parsePrice = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v))));

export function MenuAdmin(props: { menu: MenuItem[]; repo: BarRepo; onBack: () => void }) {
  const { menu, repo } = props;
  const [cat, setCat] = useState<CategoryId>('classic');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const run = (p: Promise<void>, after?: () => void) =>
    p.then(() => {
      setError('');
      after?.();
    }, (e) => setError(errorText(e)));
  const items = menu.filter((m) => m.categoryId === cat).sort((a, b) => a.sort - b.sort);

  return (
    <main className="screen">
      <header className="bar">
        <button className="link" onClick={props.onBack}>← 桌位</button>
        <h1>酒單</h1>
      </header>
      <div role="tablist" className="tabs">
        {CATEGORIES.map((c) => (
          <button key={c.id} role="tab" aria-selected={c.id === cat} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>
      {error && <p role="alert" className="alert">{error}</p>}
      <ul className="admin-list">
        {items.map((m, i) =>
          editing === m.id ? (
            <li key={m.id} aria-label={m.name}>
              <ItemForm
                label={`編輯 ${m.name}`}
                initial={m}
                submitLabel="儲存"
                onCancel={() => setEditing(null)}
                onSubmit={(name, price) => run(repo.updateMenuItem(m.id, { name, price }), () => setEditing(null))}
              />
            </li>
          ) : (
            <li key={m.id} aria-label={m.name} className={m.active ? '' : 'inactive'}>
              <button className="line-main" aria-label={`編輯 ${m.name}`} onClick={() => setEditing(m.id)}>
                <span className="line-name">{m.name}</span>
                <span className="line-hint">
                  {m.price === null ? '價格待補' : `$${m.price}`}
                  {!m.active && ' · 已下架'}
                </span>
              </button>
              <div className="stepper">
                <button aria-label={`上移 ${m.name}`} disabled={i === 0} onClick={() => run(repo.moveMenuItem(m.id, -1))}>↑</button>
                <button aria-label={`下移 ${m.name}`} disabled={i === items.length - 1} onClick={() => run(repo.moveMenuItem(m.id, 1))}>↓</button>
                <button
                  className="toggle"
                  aria-label={`${m.active ? '下架' : '上架'} ${m.name}`}
                  onClick={() => run(repo.updateMenuItem(m.id, { active: !m.active }))}
                >
                  {m.active ? '下架' : '上架'}
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {items.length === 0 && <p className="empty">這個分類還沒有品項</p>}
      <ItemForm
        key={cat}
        label="新增品項"
        submitLabel="新增"
        resetOnSubmit
        onSubmit={(name, price) => run(repo.addMenuItem({ categoryId: cat, name, price }))}
      />
    </main>
  );
}

function ItemForm(props: {
  label: string;
  initial?: MenuItem;
  submitLabel: string;
  resetOnSubmit?: boolean;
  onCancel?: () => void;
  onSubmit: (name: string, price: number | null) => Promise<void>;
}) {
  const [name, setName] = useState(props.initial?.name ?? '');
  const [price, setPrice] = useState(props.initial?.price?.toString() ?? '');
  return (
    <form
      aria-label={props.label}
      className="item-form"
      onSubmit={(e) => {
        e.preventDefault();
        void props.onSubmit(name, parsePrice(price)).then(() => {
          if (props.resetOnSubmit) {
            setName('');
            setPrice('');
          }
        });
      }}
    >
      <input aria-label="名稱" placeholder="名稱" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        aria-label="參考價"
        placeholder="參考價"
        type="number"
        inputMode="numeric"
        min={0}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      {props.onCancel && <button type="button" className="ghost small" onClick={props.onCancel}>取消</button>}
      <button type="submit" className="primary small">{props.submitLabel}</button>
    </form>
  );
}
