import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createLocalRepo } from '../data/localRepo';

const M = 60 * 1000;
const H = 60 * M;
const START = new Date('2026-11-14T20:00:00+08:00').getTime();

function setup() {
  const clock = { now: START };
  let n = 0;
  const user = userEvent.setup();
  const repo = createLocalRepo(localStorage, () => clock.now, () => `id${++n}`);
  const utils = render(<App repo={repo} clock={() => clock.now} />);
  const rerender = () => utils.rerender(<App repo={repo} clock={() => clock.now} />);
  return { user, clock, rerender };
}
async function order(user: ReturnType<typeof userEvent.setup>, tableId: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${tableId} `) }));
  await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
  await user.click(screen.getByRole('button', { name: /^Manhattan/ }));
  await user.click(screen.getByRole('button', { name: '完成' }));
  await user.click(screen.getByRole('button', { name: '← 桌位' }));
}

describe('T5 驗收：結束營業', () => {
  it('未輸入「結束」無法送出；送出後所有使用中的桌清空並封存', async () => {
    const { user, clock } = setup();
    await order(user, 'B1');
    await order(user, 'C9');
    clock.now += 6 * H;
    await user.click(screen.getByRole('button', { name: '結束營業' }));
    const dlg = screen.getByRole('dialog', { name: '結束營業？' });
    expect(dlg).toHaveTextContent('2 桌');
    const go = within(dlg).getByRole('button', { name: '確定結束' });
    expect(go).toBeDisabled();
    await user.type(within(dlg).getByRole('textbox', { name: '輸入「結束」確認' }), '結');
    expect(go).toBeDisabled();
    await user.type(within(dlg).getByRole('textbox', { name: '輸入「結束」確認' }), '束');
    expect(go).toBeEnabled();
    await user.click(go);

    expect(screen.getByRole('button', { name: 'B1 空桌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C9 空桌' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '歷史' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('10 分鐘內可復原，桌況與結束前一致；超過 10 分鐘復原鈕消失', async () => {
    const { user, clock, rerender } = setup();
    await order(user, 'B2');
    clock.now += 5 * H;
    await user.click(screen.getByRole('button', { name: '結束營業' }));
    await user.type(screen.getByRole('textbox', { name: '輸入「結束」確認' }), '結束');
    await user.click(screen.getByRole('button', { name: '確定結束' }));
    expect(screen.getByRole('status')).toHaveTextContent('已結束營業');

    clock.now += 9 * M;
    rerender();
    await user.click(screen.getByRole('button', { name: '復原結束營業' }));
    expect(screen.getByRole('button', { name: /^B2 使用中 1 杯 20:00 開桌/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '結束營業' }));
    await user.type(screen.getByRole('textbox', { name: '輸入「結束」確認' }), '結束');
    await user.click(screen.getByRole('button', { name: '確定結束' }));
    clock.now += 10 * M + 1;
    rerender();
    expect(screen.queryByRole('button', { name: '復原結束營業' })).not.toBeInTheDocument();
  });

  it('營業日超過 18 小時 → 首頁提醒', async () => {
    const { user, clock, rerender } = setup();
    await order(user, 'B3');
    expect(screen.queryByText(/已超過 18 小時/)).not.toBeInTheDocument();
    clock.now += 18 * H;
    rerender();
    expect(screen.getByRole('status')).toHaveTextContent('營業日從 11/14 20:00 開始，已超過 18 小時');
  });

  it('沒有營業中時不顯示結束營業', () => {
    setup();
    expect(screen.queryByRole('button', { name: '結束營業' })).not.toBeInTheDocument();
  });
});
