import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createLocalRepo } from '../data/localRepo';

// 2026-11-14 22:30 台北時間
const NOW = new Date('2026-11-14T22:30:00+08:00').getTime();
const setup = () => {
  const repo = createLocalRepo(localStorage, () => NOW);
  const user = userEvent.setup();
  const utils = render(<App repo={repo} />);
  return { repo, user, ...utils };
};

describe('T1 驗收', () => {
  it('首頁顯示 29 桌，分 B、C 兩區', () => {
    setup();
    const b = screen.getByRole('region', { name: 'B 區' });
    const c = screen.getByRole('region', { name: 'C 區' });
    expect(within(b).getAllByRole('button')).toHaveLength(20);
    expect(within(c).getAllByRole('button')).toHaveLength(9);
    expect(screen.getByRole('button', { name: /^B1 空桌/ })).toBeInTheDocument();
  });

  it('空桌加第一杯後變使用中，顯示杯數與開桌時間；同酒連點累加', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /^B5 空桌/ }));
    expect(screen.getByRole('heading', { name: 'B5' })).toBeInTheDocument();
    expect(screen.getByText('尚未點酒')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
    await user.click(screen.getByRole('tab', { name: 'REVIVER 調酒' }));
    await user.click(screen.getByRole('button', { name: /^夜未央/ }));
    await user.click(screen.getByRole('button', { name: /^夜未央/ }));
    await user.click(screen.getByRole('button', { name: '完成' }));

    const line = screen.getByRole('listitem', { name: '夜未央' });
    expect(line).toHaveTextContent('×2');

    await user.click(screen.getByRole('button', { name: '← 桌位' }));
    expect(screen.getByRole('button', { name: 'B5 使用中 2 杯 22:30 開桌' })).toBeInTheDocument();
  });

  it('選酒畫面依分類分頁，客座目前無品項；不顯示非調酒', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /^C1 空桌/ }));
    await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['CLASSIC', 'REVIVER 調酒', '客座']);
    expect(screen.getByRole('button', { name: /^Old Fashioned/ })).toBeInTheDocument();
    expect(screen.queryByText('台啤')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '客座' }));
    expect(screen.getByText('目前沒有上架品項')).toBeInTheDocument();
  });

  it('選酒時顯示參考價，價格待補的品項不顯示金額', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /^C1 空桌/ }));
    await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
    expect(screen.getByRole('button', { name: /^Manhattan/ })).toHaveTextContent('$400');
    expect(screen.getByRole('button', { name: /^Robroy/ })).not.toHaveTextContent('$');
  });

  it('重新整理後資料還在', async () => {
    const { user, unmount } = setup();
    await user.click(screen.getByRole('button', { name: /^C2 空桌/ }));
    await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
    await user.click(screen.getByRole('button', { name: /^Penicillin/ }));
    await user.click(screen.getByRole('button', { name: '完成' }));
    unmount();

    setup();
    expect(screen.getByRole('button', { name: /^C2 使用中 1 杯/ })).toBeInTheDocument();
  });
});
