import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createLocalRepo } from '../data/localRepo';

const NOW = new Date('2026-11-14T22:30:00+08:00').getTime();

async function openTableWith(tableId: string, drinks: [tab: string, name: string][]) {
  const user = userEvent.setup();
  let n = 0;
  render(<App repo={createLocalRepo(localStorage, () => NOW, () => `id${++n}`)} />);
  await user.click(screen.getByRole('button', { name: new RegExp(`^${tableId} 空桌`) }));
  if (drinks.length) {
    await user.click(screen.getByRole('button', { name: '＋ 加酒' }));
    for (const [tab, name] of drinks) {
      await user.click(screen.getByRole('tab', { name: tab }));
      await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
    }
    await user.click(screen.getByRole('button', { name: '完成' }));
  }
  return user;
}

describe('T2 驗收：每杯備註', () => {
  it('夜未央 ×2 其中 1 杯少甜 → 拆成兩筆', async () => {
    const user = await openTableWith('B5', [['REVIVER 調酒', '夜未央'], ['REVIVER 調酒', '夜未央']]);
    await user.click(screen.getByRole('button', { name: '編輯備註 夜未央' }));
    await user.click(screen.getByRole('button', { name: '少甜' }));
    expect(screen.getByRole('button', { name: '少甜' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('套用 2 / 2 杯')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '套用杯數減一' }));
    expect(screen.getByText('套用 1 / 2 杯')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '儲存' }));

    expect(within(screen.getByRole('listitem', { name: '夜未央' })).getByText('×1')).toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: '夜未央｜少甜' })).getByText('×1')).toBeInTheDocument();
  });

  it('快速鍵可複選並加自由文字', async () => {
    const user = await openTableWith('B6', [['CLASSIC', 'Old Fashioned']]);
    await user.click(screen.getByRole('button', { name: '編輯備註 Old Fashioned' }));
    await user.click(screen.getByRole('button', { name: '少冰' }));
    await user.click(screen.getByRole('button', { name: '少甜' }));
    await user.type(screen.getByRole('textbox', { name: '其他備註' }), '換波本');
    expect(screen.queryByText(/套用 .* 杯/)).not.toBeInTheDocument(); // 只有 1 杯時不顯示套用杯數
    await user.click(screen.getByRole('button', { name: '儲存' }));
    const li = screen.getByRole('listitem', { name: 'Old Fashioned｜少甜、少冰、換波本' });
    expect(li).toHaveTextContent('少甜、少冰、換波本');
  });

  it('取消不會改動', async () => {
    const user = await openTableWith('B7', [['CLASSIC', 'Manhattan']]);
    await user.click(screen.getByRole('button', { name: '編輯備註 Manhattan' }));
    await user.click(screen.getByRole('button', { name: '加濃' }));
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByRole('listitem', { name: 'Manhattan' })).toBeInTheDocument();
  });
});

describe('T2 驗收：數量增減', () => {
  it('＋／− 改數量，減到 0 刪除；最後一杯刪掉變回空桌', async () => {
    const user = await openTableWith('C1', [['CLASSIC', 'Penicillin']]);
    await user.click(screen.getByRole('button', { name: 'Penicillin 加一杯' }));
    expect(screen.getByRole('listitem', { name: 'Penicillin' })).toHaveTextContent('×2');
    await user.click(screen.getByRole('button', { name: 'Penicillin 減一杯' }));
    await user.click(screen.getByRole('button', { name: 'Penicillin 減一杯' }));
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByText('尚未點酒')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '← 桌位' }));
    expect(screen.getByRole('button', { name: 'C1 空桌' })).toBeInTheDocument();
  });
});

describe('T2 驗收：桌備註', () => {
  it('只有桌備註、沒有酒的桌仍算使用中', async () => {
    const user = await openTableWith('C2', []);
    await user.type(screen.getByRole('textbox', { name: '桌備註' }), '靠窗那位是壽星');
    await user.click(screen.getByRole('button', { name: '儲存桌備註' }));
    expect(screen.getByRole('textbox', { name: '桌備註' })).toHaveValue('靠窗那位是壽星');
    await user.click(screen.getByRole('button', { name: '← 桌位' }));
    expect(screen.getByRole('button', { name: 'C2 使用中 0 杯 22:30 開桌 有桌備註' })).toBeInTheDocument();
  });

  it('桌備註未修改時不顯示儲存鈕', async () => {
    await openTableWith('C3', []);
    expect(screen.queryByRole('button', { name: '儲存桌備註' })).not.toBeInTheDocument();
  });
});
