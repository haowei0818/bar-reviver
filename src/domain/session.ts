/**
 * 桌次（一組客人）的所有規則。純函式、不可變、不依賴框架與資料庫。
 *
 * 不變式：無備註的「一般行」lineId === menuItemId，因此同一杯酒的加點永遠累加到同一行；
 * 帶備註的行使用其他 lineId。
 */

export const QUICK_TAGS = ['少甜', '少冰', '去冰', '加濃', '不要酒精'] as const;

export type OrderLine = {
  lineId: string;
  menuItemId: string;
  name: string;
  qty: number;
  addedAt: number;
  tags: string[];
  note: string;
};
export type TableSession = {
  tableId: string;
  openedAt: number;
  lines: OrderLine[];
  note: string;
  /** T7：桌已被別支手機清掉後，離線補傳重建出來的桌次 */
  recovered?: boolean;
};
export type TableStatus = 'empty' | 'occupied';
export type LineNotes = { tags: string[]; note: string };

const isPlain = (n: LineNotes) => n.tags.length === 0 && n.note === '';

/** 統一排序：加入時間 → 一般行優先 → lineId。本機與雲端都用這個規則。 */
export function sortLines(lines: OrderLine[]): OrderLine[] {
  return [...lines].sort(
    (a, b) =>
      a.addedAt - b.addedAt ||
      Number(!isPlain(a)) - Number(!isPlain(b)) ||
      a.lineId.localeCompare(b.lineId),
  );
}

function normalizeNotes(n: LineNotes): LineNotes {
  const set = new Set(n.tags);
  return { tags: QUICK_TAGS.filter((t) => set.has(t)), note: n.note.trim() };
}

/** 回傳 undefined 代表這桌變回空桌 */
function finalize(s: TableSession): TableSession | undefined {
  if (s.lines.length === 0 && s.note === '') return undefined;
  return { ...s, lines: sortLines(s.lines) };
}

function assertTable(s: TableSession | undefined, tableId: string) {
  if (s && s.tableId !== tableId) throw new Error(`桌號不符：${s.tableId} ≠ ${tableId}`);
}

function findLine(s: TableSession, lineId: string): OrderLine {
  const line = s.lines.find((l) => l.lineId === lineId);
  if (!line) throw new Error(`找不到品項：${lineId}`);
  return line;
}

/** 加一杯（無備註）：空桌自動開桌次；同酒累加到一般行。 */
export function addItem(
  session: TableSession | undefined,
  tableId: string,
  item: { id: string; name: string },
  now: number,
): TableSession {
  assertTable(session, tableId);
  const base = session ?? { tableId, openedAt: now, lines: [], note: '' };
  const plain = base.lines.find((l) => l.lineId === item.id);
  const lines = plain
    ? base.lines.map((l) => (l === plain ? { ...l, qty: l.qty + 1 } : l))
    : [...base.lines, { lineId: item.id, menuItemId: item.id, name: item.name, qty: 1, addedAt: now, tags: [], note: '' }];
  return finalize({ ...base, lines })!;
}

/**
 * 設定某行的備註，套用到其中 applyQty 杯。
 * 少於整行時拆出新行；清空備註時併回一般行。newLineId 由呼叫端產生（需全域唯一）。
 */
export function setLineNotes(
  session: TableSession,
  lineId: string,
  notes: LineNotes,
  applyQty: number,
  newLineId: string,
  _now: number,
): TableSession {
  const line = findLine(session, lineId);
  if (!Number.isInteger(applyQty) || applyQty < 1 || applyQty > line.qty) {
    throw new Error(`套用杯數需介於 1 與 ${line.qty}`);
  }
  const n = normalizeNotes(notes);
  const others = session.lines.filter((l) => l !== line);
  const plainSibling = others.find((l) => l.lineId === line.menuItemId);
  const rest = line.qty - applyQty;
  const remaining: OrderLine[] = rest > 0 ? [{ ...line, qty: rest }] : [];

  let lines: OrderLine[];
  if (isPlain(n)) {
    // 這幾杯變成無備註 → 併入一般行（可能是自己剩下的部分或另一行）
    const plainTarget = line.lineId === line.menuItemId ? remaining[0] : plainSibling;
    if (plainTarget) {
      const merged = { ...plainTarget, qty: plainTarget.qty + applyQty };
      lines = [...others.filter((l) => l !== plainTarget), ...remaining.filter((l) => l !== plainTarget), merged];
    } else {
      lines = [...others, ...remaining, { ...line, lineId: line.menuItemId, qty: applyQty, ...n }];
    }
  } else {
    const keepId = rest === 0 && line.lineId !== line.menuItemId;
    lines = [...others, ...remaining, { ...line, lineId: keepId ? line.lineId : newLineId, qty: applyQty, ...n }];
  }
  return finalize({ ...session, lines })!;
}

/** 數量 ±；減到 0 刪除該行；整桌沒酒也沒桌備註時回傳 undefined（空桌）。 */
export function changeQty(session: TableSession, lineId: string, delta: number): TableSession | undefined {
  const line = findLine(session, lineId);
  const qty = line.qty + delta;
  const lines = qty > 0 ? session.lines.map((l) => (l === line ? { ...l, qty } : l)) : session.lines.filter((l) => l !== line);
  return finalize({ ...session, lines });
}

/** 桌備註：空桌寫入會開桌次；沒酒時清空會變回空桌。 */
export function setTableNote(
  session: TableSession | undefined,
  tableId: string,
  note: string,
  now: number,
): TableSession | undefined {
  assertTable(session, tableId);
  const base = session ?? { tableId, openedAt: now, lines: [], note: '' };
  return finalize({ ...base, note: note.trim() });
}

export function cupCount(session?: TableSession): number {
  return session ? session.lines.reduce((n, l) => n + l.qty, 0) : 0;
}

export function statusOf(session?: TableSession): TableStatus {
  return session && (session.lines.length > 0 || session.note !== '') ? 'occupied' : 'empty';
}
