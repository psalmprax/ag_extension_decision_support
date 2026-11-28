import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadJson } from '../downloadJson';

describe('downloadJson', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads the data as a named JSON file and releases the object URL', () => {
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { created.push(blob as Blob); return 'blob:x'; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadJson('workflow-maize-v2.json', { steps: [1] });

    expect(created[0].type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
