import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createLocalRepo } from '../data/localRepo';

const BASE = 'https://bar-reviver.web.app/';
function setup(urlKey: string | null, keys = ['aaaa1111bbbb2222', 'cccc3333dddd4444']) {
  const onKeyChange = vi.fn();
  const gen = vi.fn(() => keys.shift()!);
  const user = userEvent.setup();
  const repo = createLocalRepo(localStorage);
  const utils = render(<App repo={repo} urlKey={urlKey} baseUrl={BASE} onKeyChange={onKeyChange} genKey={gen} />);
  return { user, onKeyChange, repo, ...utils };
}

describe('T8 驗收：亂碼網址', () => {
  it('首次使用（尚未設定）可進入，並可產生專屬網址', async () => {
    const { user, onKeyChange, unmount } = setup(null);
    expect(screen.getByRole('region', { name: 'B 區' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '網址' }));
    expect(screen.getByText('尚未設定專屬網址，任何人打開網址都能使用。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '產生專屬網址' }));
    await user.click(screen.getByRole('button', { name: '確定更換' }));
    expect(onKeyChange).toHaveBeenCalledWith('aaaa1111bbbb2222');
    unmount();

    setup(null);
    expect(screen.getByRole('heading', { name: '網址已失效' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'B 區' })).not.toBeInTheDocument();
  });

  it('不帶亂碼或亂碼錯誤的網址打不開', () => {
    localStorage.setItem('bar-reviver:state:v2', JSON.stringify({ settings: { accessKey: 'aaaa1111bbbb2222' } }));
    setup('wrong');
    expect(screen.getByRole('heading', { name: '網址已失效' })).toBeInTheDocument();
  });

  it('更換後舊網址立即失效、新網址可用，並顯示新網址', async () => {
    localStorage.setItem('bar-reviver:state:v2', JSON.stringify({ settings: { accessKey: 'aaaa1111bbbb2222' } }));
    const { user, onKeyChange, rerender, repo } = setup('aaaa1111bbbb2222', ['cccc3333dddd4444']);
    await user.click(screen.getByRole('button', { name: '網址' }));
    expect(screen.getByText(`${BASE}?k=aaaa1111bbbb2222`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '更換網址' }));
    await user.click(screen.getByRole('button', { name: '確定更換' }));
    expect(onKeyChange).toHaveBeenCalledWith('cccc3333dddd4444');

    rerender(<App repo={repo} urlKey="cccc3333dddd4444" baseUrl={BASE} onKeyChange={onKeyChange} />);
    expect(screen.getByText(`${BASE}?k=cccc3333dddd4444`)).toBeInTheDocument();
    rerender(<App repo={repo} urlKey="aaaa1111bbbb2222" baseUrl={BASE} onKeyChange={onKeyChange} />);
    expect(screen.getByRole('heading', { name: '網址已失效' })).toBeInTheDocument();
  });
});
