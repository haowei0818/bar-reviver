import { describe, it, expect } from 'vitest';
import { emptyState } from './bar';
import { accessOf, rotateAccessKey, newAccessKey } from './access';

describe('T8 亂碼網址', () => {
  it('尚未設定網址金鑰 → 開放（首次部署可進入並產生）', () => {
    expect(accessOf(emptyState(), null)).toBe('open');
  });

  it('已設定 → 網址金鑰相符才可進入', () => {
    const st = rotateAccessKey(emptyState(), 'k3x9a7q2m8vd');
    expect(accessOf(st, 'k3x9a7q2m8vd')).toBe('ok');
    expect(accessOf(st, null)).toBe('denied');
    expect(accessOf(st, 'wrong')).toBe('denied');
  });

  it('更換後舊金鑰立即失效', () => {
    let st = rotateAccessKey(emptyState(), 'old-key-aaaa');
    st = rotateAccessKey(st, 'new-key-bbbb');
    expect(accessOf(st, 'old-key-aaaa')).toBe('denied');
    expect(accessOf(st, 'new-key-bbbb')).toBe('ok');
  });

  it('產生的金鑰夠長且只含網址安全字元', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newAccessKey()));
    expect(keys.size).toBe(50);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9]{16}$/);
  });

  it('太短的金鑰拒絕', () => {
    expect(() => rotateAccessKey(emptyState(), 'short')).toThrow();
  });
});
