import { useState } from 'react';
import { QUICK_TAGS, type OrderLine } from '../../domain/session';

export function NoteEditor(props: {
  line: OrderLine;
  onCancel: () => void;
  onSave: (notes: { tags: string[]; note: string }, applyQty: number) => void;
}) {
  const { line, onCancel, onSave } = props;
  const [tags, setTags] = useState<string[]>(line.tags);
  const [note, setNote] = useState(line.note);
  const [qty, setQty] = useState(line.qty);
  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  return (
    <main className="screen">
      <header className="bar">
        <button className="link" onClick={onCancel}>取消</button>
        <h1>{line.name} 備註</h1>
      </header>
      <div className="chips">
        {QUICK_TAGS.map((t) => (
          <button key={t} aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>{t}</button>
        ))}
      </div>
      <label className="field">
        <span>其他備註</span>
        <input aria-label="其他備註" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：換波本、不要橙皮" />
      </label>
      {line.qty > 1 && (
        <div className="apply">
          <button aria-label="套用杯數減一" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
          <span>套用 {qty} / {line.qty} 杯</span>
          <button aria-label="套用杯數加一" disabled={qty >= line.qty} onClick={() => setQty(qty + 1)}>＋</button>
        </div>
      )}
      <footer className="actions">
        <button className="primary" onClick={() => onSave({ tags, note }, qty)}>儲存</button>
      </footer>
    </main>
  );
}
