import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createLocalRepo } from '../data/localRepo';

const NOW = new Date('2026-11-14T22:30:00+08:00').getTime();
function setup() {
  let n = 0;
  const user = userEvent.setup();
  render(<App repo={createLocalRepo(localStorage, () => NOW, () => `id${++n}`)} />);
  return user;
}
type U = ReturnType<typeof userEvent.setup>;
const openAdmin = async (user: U) => user.click(screen.getByRole('button', { name: '酒單' }));
const back = async (user: U) => user.click(screen.getByRole('button', { name: '← 桌位' }));
async function openPicker(user: U, tableId: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${tableId} `) }));
  await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
}

describe('T6 驗收：酒單後台', () => {
  it('下架：選酒畫面不出現，但桌上已點的照常顯示', async () => {
    const user = setup();
    await openPicker(user, 'B1');
    await user.click(screen.getByRole('button', { name: /^Manhattan/ }));
    await user.click(screen.getByRole('button', { name: '完成' }));
    await back(user);

    await openAdmin(user);
    await user.click(screen.getByRole('button', { name: '下架 Manhattan' }));
    expect(screen.getByRole('listitem', { name: 'Manhattan' })).toHaveTextContent('已下架');
    await back(user);

    await user.click(screen.getByRole('button', { name: /^B1 / }));
    expect(screen.getByRole('listitem', { name: 'Manhattan' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
    expect(screen.queryByRole('button', { name: /^Manhattan/ })).not.toBeInTheDocument();
  });

  it('改名：之後的選酒用新名；已點的保留舊名', async () => {
    const user = setup();
    await openPicker(user, 'B2');
    await user.click(screen.getByRole('button', { name: /^Old Fashioned/ }));
    await user.click(screen.getByRole('button', { name: '完成' }));
    await back(user);

    await openAdmin(user);
    await user.click(screen.getByRole('button', { name: '編輯 Old Fashioned' }));
    const edit = screen.getByRole('form', { name: '編輯 Old Fashioned' });
    const name = within(edit).getByRole('textbox', { name: '名稱' });
    await user.clear(name);
    await user.type(name, 'Old Fashioned（波本）');
    const price = within(edit).getByRole('spinbutton', { name: '參考價' });
    await user.clear(price);
    await user.type(price, '420');
    await user.click(within(edit).getByRole('button', { name: '儲存' }));
    await back(user);

    await user.click(screen.getByRole('button', { name: /^B2 / }));
    expect(screen.getByRole('listitem', { name: 'Old Fashioned' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
    expect(screen.getByRole('button', { name: /^Old Fashioned（波本）/ })).toHaveTextContent('$420');
  });

  it('排序變更反映在選酒畫面', async () => {
    const user = setup();
    await openAdmin(user);
    await user.click(screen.getByRole('button', { name: '上移 Hunter' }));
    await back(user);
    await openPicker(user, 'B3');
    const names = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(names.findIndex((t) => t.startsWith('Hunter'))).toBeLessThan(names.findIndex((t) => t.startsWith('Hot Toddy')));
  });

  it('新增客座品項', async () => {
    const user = setup();
    await openAdmin(user);
    await user.click(screen.getByRole('tab', { name: '客座' }));
    const form = screen.getByRole('form', { name: '新增品項' });
    await user.type(within(form).getByRole('textbox', { name: '名稱' }), '阿廖特調');
    await user.type(within(form).getByRole('spinbutton', { name: '參考價' }), '420');
    await user.click(within(form).getByRole('button', { name: '新增' }));
    expect(screen.getByRole('listitem', { name: '阿廖特調' })).toBeInTheDocument();
    await back(user);
    await openPicker(user, 'C1');
    await user.click(screen.getByRole('tab', { name: '客座' }));
    expect(screen.getByRole('button', { name: /^阿廖特調/ })).toHaveTextContent('$420');
  });

  it('同分類重複名稱顯示錯誤', async () => {
    const user = setup();
    await openAdmin(user);
    const form = screen.getByRole('form', { name: '新增品項' });
    await user.type(within(form).getByRole('textbox', { name: '名稱' }), 'Manhattan');
    await user.click(within(form).getByRole('button', { name: '新增' }));
    expect(screen.getByRole('alert')).toHaveTextContent('這個分類已有「Manhattan」');
  });
});
