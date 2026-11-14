import type { BarState } from './bar';

/**
 * 亂碼網址：網址需帶 ?k=<金鑰> 才能使用。
 * 注意：這只是「不容易被猜到」，不是真正的權限控管（規格 Q7 已接受此風險）。
 */
export type Access = 'open' | 'ok' | 'denied';

export function accessOf(state: BarState, urlKey: string | null): Access {
  const key = state.settings.accessKey;
  if (!key) return 'open';
  return urlKey === key ? 'ok' : 'denied';
}

export function rotateAccessKey(state: BarState, key: string): BarState {
  if (!/^[a-z0-9-]{12,}$/.test(key)) throw new Error('金鑰至少 12 個英數字');
  return { ...state, settings: { ...state.settings, accessKey: key } };
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function newAccessKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
