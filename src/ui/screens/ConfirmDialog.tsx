import { useId, type ReactNode } from 'react';

export function ConfirmDialog(props: {
  title: string;
  confirmLabel: string;
  children?: ReactNode;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  return (
    <div className="backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby={id} className="dialog">
        <h2 id={id}>{props.title}</h2>
        {props.children}
        <div className="dialog-actions">
          <button className="ghost" onClick={props.onCancel}>取消</button>
          <button className="primary danger" disabled={props.confirmDisabled} onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
