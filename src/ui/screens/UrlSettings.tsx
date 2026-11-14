import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export function UrlSettings(props: { url: string | null; onBack: () => void; onRotate: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <main className="screen">
      <header className="bar">
        <button className="link" onClick={props.onBack}>← 桌位</button>
        <h1>網址</h1>
      </header>
      {props.url ? (
        <section className="card">
          <p className="muted">把這個網址傳給員工，或加入手機主畫面。</p>
          <p className="url">{props.url}</p>
          <button
            className="ghost small"
            onClick={() => navigator.clipboard?.writeText(props.url!).then(() => setCopied(true))}
          >
            {copied ? '已複製' : '複製網址'}
          </button>
        </section>
      ) : (
        <p className="card">尚未設定專屬網址，任何人打開網址都能使用。</p>
      )}
      <p className="muted small-print">
        網址外流時可以更換，舊網址會立即失效，所有員工需要改用新網址。這是「不容易被猜到」的保護，不等於帳號密碼。
      </p>
      <footer className="actions">
        <button className="primary" onClick={() => setConfirming(true)}>{props.url ? '更換網址' : '產生專屬網址'}</button>
      </footer>
      {confirming && (
        <ConfirmDialog
          title="更換網址？"
          confirmLabel="確定更換"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            props.onRotate();
          }}
        >
          <p className="muted">{props.url ? '舊網址會立即失效，其他手機需要重新打開新網址。' : '產生後，只有帶著這個網址的手機能使用。'}</p>
        </ConfirmDialog>
      )}
    </main>
  );
}

export function Denied() {
  return (
    <main className="screen denied">
      <h1>網址已失效</h1>
      <p className="muted">請向店長索取新的網址。</p>
    </main>
  );
}
