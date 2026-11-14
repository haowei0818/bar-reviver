import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createLocalRepo } from '../data/localRepo';

let clock = new Date('2026-11-14T22:30:00+08:00').getTime();
const setup = () => {
  let n = 0;
  const user = userEvent.setup();
  render(<App repo={createLocalRepo(localStorage, () => clock, () => `id${++n}`)} />);
  return user;
};
async function order(user: ReturnType<typeof userEvent.setup>, tableId: string, drink: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${tableId} `) }));
  await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
  await user.click(screen.getByRole('button', { name: new RegExp(`^${drink}`) }));
  await user.click(screen.getByRole('button', { name: '完成' }));
}

describe('T4 驗收：清桌', () => {
  it('清桌前跳一次確認；取消不清', async () => {
    const user = setup();
    await order(user, 'B5', 'Manhattan');
    await user.click(screen.getByRole('button', { name: '清桌' }));
    const dlg = screen.getByRole('dialog', { name: '清桌 B5？' });
    await user.click(within(dlg).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Manhattan' })).toBeInTheDocument();
  });

  it('確認清桌 → 回桌位總覽、該桌變空桌', async () => {
    const user = setup();
    await order(user, 'B5', 'Manhattan');
    await user.click(screen.getByRole('button', { name: '清桌' }));
    await user.click(screen.getByRole('button', { name: '確定清桌' }));
    expect(screen.getByRole('button', { name: 'B5 空桌' })).toBeInTheDocument();
  });

  it('空桌不顯示清桌鈕', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'B1 空桌' }));
    expect(screen.queryByRole('button', { name: '清桌' })).not.toBeInTheDocument();
  });
});

describe('T4 驗收：歷史與還原', () => {
  it('歷史看得到完整明細與備註，桌為空桌時可還原', async () => {
    const user = setup();
    await order(user, 'C2', 'Penicillin');
    await user.click(screen.getByRole('button', { name: '編輯備註 Penicillin' }));
    await user.click(screen.getByRole('button', { name: '少冰' }));
    await user.click(screen.getByRole('button', { name: '儲存' }));
    await user.type(screen.getByRole('textbox', { name: '桌備註' }), '分開結帳');
    await user.click(screen.getByRole('button', { name: '儲存桌備註' }));
    clock += 60 * 60 * 1000;
    await user.click(screen.getByRole('button', { name: '清桌' }));
    await user.click(screen.getByRole('button', { name: '確定清桌' }));

    await user.click(screen.getByRole('button', { name: '歷史' }));
    const item = screen.getByRole('article', { name: 'C2 22:30–23:30' });
    expect(item).toHaveTextContent('Penicillin');
    expect(item).toHaveTextContent('少冰');
    expect(item).toHaveTextContent('×1');
    expect(item).toHaveTextContent('分開結帳');

    await user.click(within(item).getByRole('button', { name: '還原到 C2' }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '← 桌位' }));
    expect(screen.getByRole('button', { name: /^C2 使用中 1 杯/ })).toBeInTheDocument();
    clock -= 60 * 60 * 1000;
  });

  it('桌上已有新客人 → 提示不可還原', async () => {
    const user = setup();
    await order(user, 'B3', 'Hunter');
    await user.click(screen.getByRole('button', { name: '清桌' }));
    await user.click(screen.getByRole('button', { name: '確定清桌' }));
    await order(user, 'B3', 'Old Pal');
    await user.click(screen.getByRole('button', { name: '← 桌位' }));
    await user.click(screen.getByRole('button', { name: '歷史' }));
    await user.click(screen.getByRole('button', { name: '還原到 B3' }));
    expect(screen.getByRole('alert')).toHaveTextContent('B3 已有新客人，無法還原');
  });
});
