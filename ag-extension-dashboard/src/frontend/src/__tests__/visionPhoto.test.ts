import { describe, it, expect, vi, afterEach } from 'vitest';
import { shrinkForVision, VISION_MAX_SIDE } from '@/lib/visionPhoto';

const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';
const drawn: Array<{ width: number; height: number }> = [];

function stubBrowser(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const { width, height } = this;
    return { drawImage: () => drawn.push({ width, height }) } as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,SMALL');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  drawn.length = 0;
});

describe('shrinkForVision', () => {
  it('redraws a large photo with its long side at the limit', async () => {
    stubBrowser(4000, 3000);
    expect(await shrinkForVision(PHOTO)).toBe('data:image/jpeg;base64,SMALL');
    expect(drawn).toEqual([{ width: VISION_MAX_SIDE, height: 768 }]);
  });

  it('keeps bare base64 bare', async () => {
    stubBrowser(3000, 4000);
    expect(await shrinkForVision('/9j/AAAA')).toBe('SMALL');
  });

  it('leaves a photo that is already small enough alone', async () => {
    stubBrowser(800, 600);
    expect(await shrinkForVision(PHOTO)).toBe(PHOTO);
    expect(drawn).toEqual([]);
  });

  it('sends the photo as it is when the browser cannot redraw it', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    expect(await shrinkForVision(PHOTO)).toBe(PHOTO);
  });
});
