import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetErrorReportingForTests, reportBrowserError } from '../lib/errorReporting';

describe('browser error reporting', () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

  beforeEach(() => {
    __resetErrorReportingForTests();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends an uncaught error to /api/errors with its source and page', () => {
    expect(reportBrowserError('promise', new TypeError("Cannot read properties of undefined (reading 'summary')"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/errors');
    const body = JSON.parse(String(init.body));
    expect(body.source).toBe('promise');
    expect(body.error).toMatchObject({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'summary')" });
    expect(body.url).toBe(window.location.href);
  });

  it('sends the same error once, and at most ten errors per page load', () => {
    reportBrowserError('window', new Error('same'));
    reportBrowserError('window', new Error('same'));
    for (let i = 0; i < 20; i += 1) reportBrowserError('window', new Error(`error ${i}`));
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('ignores browser noise and non-error rejections still report as text', () => {
    expect(reportBrowserError('window', new Error('ResizeObserver loop completed with undelivered notifications.'))).toBe(false);
    expect(reportBrowserError('promise', 'timeout')).toBe(true);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.error).toEqual({ name: 'Error', message: 'timeout' });
  });

});
