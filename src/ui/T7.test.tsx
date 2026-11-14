import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createLocalRepo } from '../data/localRepo';
import type { BarRepo, SyncStatus } from '../data/repo';

function withFakeSync(repo: BarRepo) {
  let push: (s: SyncStatus) => void = () => {};
  const r: BarRepo = { ...repo, onSync: (cb) => ((push = cb), () => {}) };
  return { repo: r, set: (s: SyncStatus) => act(() => push(s)) };
}

describe('T7 驗收：離線', () => {
  it('離線時顯示「離線中，N 筆待同步」，仍可照常記單；恢復連線同步完後提示消失', async () => {
    const { repo, set } = withFakeSync(createLocalRepo(localStorage, () => Date.now()));
    const user = userEvent.setup();
    render(<App repo={repo} />);
    set({ online: false, pendingDocs: 3 });
    expect(screen.getByRole('status', { name: '同步狀態' })).toHaveTextContent('離線中，3 筆待同步');

    await user.click(screen.getByRole('button', { name: /^B1 / }));
    await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
    await user.click(screen.getByRole('button', { name: /^Manhattan/ }));
    expect(screen.getByRole('status', { name: '同步狀態' })).toBeInTheDocument(); // 每個畫面都看得到

    set({ online: true, pendingDocs: 1 });
    expect(screen.getByRole('status', { name: '同步狀態' })).toHaveTextContent('同步中');
    set({ online: true, pendingDocs: 0 });
    expect(screen.queryByRole('status', { name: '同步狀態' })).not.toBeInTheDocument();
  });

  it('本機試用模式不顯示同步狀態', () => {
    render(<App repo={createLocalRepo(localStorage)} />);
    expect(screen.queryByRole('status', { name: '同步狀態' })).not.toBeInTheDocument();
  });

  it('離線補傳重建的桌次有標示', async () => {
    const session = {
      tableId: 'C4', openedAt: 1000, note: '', recovered: true,
      lines: [{ lineId: 'r-02', menuItemId: 'r-02', name: '夜未央', qty: 1, addedAt: 1000, tags: [], note: '' }],
    };
    localStorage.setItem('bar-reviver:state:v2', JSON.stringify({ tables: { C4: session } }));
    const user = userEvent.setup();
    render(<App repo={createLocalRepo(localStorage)} />);
    const tile = screen.getByRole('button', { name: /^C4 使用中 1 杯 .* 離線補傳$/ });
    await user.click(tile);
    expect(screen.getByText('離線補傳：這桌在別支手機已清桌，請確認是否為同一組客人')).toBeInTheDocument();
  });
});

describe('資料庫連線錯誤', () => {
  it('雲端回報錯誤時顯示原因，而不是空白', () => {
    const { repo, set } = withFakeSync(createLocalRepo(localStorage));
    render(<App repo={repo} />);
    set({ online: true, pendingDocs: 0, error: '資料庫拒絕存取（權限不足）' });
    expect(screen.getByRole('status', { name: '同步狀態' })).toHaveTextContent('資料庫拒絕存取（權限不足）');
  });
});
