import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { safeStorage } from '@/lib/safeStorage';
import { LanguageProvider } from '@/lib/LanguageContext';

const blocked = () => {
  const denied = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('safeStorage', () => {
  it('reads and writes as usual when storage works', () => {
    expect(safeStorage.set('ag-theme-name', 'forest')).toBe(true);
    expect(safeStorage.get('ag-theme-name')).toBe('forest');
    safeStorage.remove('ag-theme-name');
    expect(safeStorage.get('ag-theme-name')).toBeNull();
  });

  it('treats blocked storage as nothing saved, without throwing', () => {
    blocked();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(safeStorage.get('user')).toBeNull();
    expect(safeStorage.set('user', '{}')).toBe(false);
    expect(() => safeStorage.remove('user')).not.toThrow();
    expect(safeStorage.json('chat_queue', [])).toEqual([]);
  });

  it('falls back when a saved value is not valid JSON', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem('outbreak_scans', '{not json');
    expect(safeStorage.json<unknown[]>('outbreak_scans', [])).toEqual([]);
  });

  it('still shows the app when the browser blocks storage', async () => {
    blocked();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ hello: 'Hello' }), { status: 200 }));
    render(<LanguageProvider><p>Farmer dashboard</p></LanguageProvider>);
    expect(await screen.findByText('Farmer dashboard')).toBeInTheDocument();
  });
});
