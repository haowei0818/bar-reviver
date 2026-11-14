import { useState } from 'react';
import type { BarState } from '../../domain/bar';
import { canUndoEnd, needsEndReminder } from '../../domain/bar';
import { ConfirmDialog } from './ConfirmDialog';
import { hhmm, md } from '../format';

export function EndDayDialog(props: { state: BarState; onCancel: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState('');
  const n = Object.keys(props.state.tables).length;
  return (
    <ConfirmDialog
      title="結束營業？"
      confirmLabel="確定結束"
      confirmDisabled={typed.trim() !== '結束'}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    >
      <p className="muted">目前 {n} 桌使用中，會全部清空並封存到歷史。10 分鐘內可以復原。</p>
      <input
        className="confirm-input"
        aria-label="輸入「結束」確認"
        placeholder="輸入「結束」"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
    </ConfirmDialog>
  );
}

/** 首頁上方的營業日提示：剛結束（可復原）、或超過 18 小時沒結束 */
export function DayBanner(props: { state: BarState; now: number; onUndo: () => void }) {
  const { state, now } = props;
  if (canUndoEnd(state, now)) {
    const n = state.lastEnd!.historyIds.length;
    return (
      <div role="status" className="banner">
        <span>已結束營業 {hhmm(state.lastEnd!.endedAt)}，{n} 桌次已封存</span>
        <button className="ghost small" aria-label="復原結束營業" onClick={props.onUndo}>復原</button>
      </div>
    );
  }
  if (needsEndReminder(state, now)) {
    const t = state.day!.startedAt;
    return (
      <div role="status" className="banner warn">
        營業日從 {md(t)} {hhmm(t)} 開始，已超過 18 小時。打烊後記得按「結束營業」。
      </div>
    );
  }
  return null;
}
