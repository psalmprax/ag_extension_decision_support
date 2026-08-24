import { BaseAIProvider, ImageAnalysisResult } from '../services/aiProvider/types';
import { extractVideoFrames } from '../services/aiProvider/videoFrameService';

jest.mock('../services/aiProvider/videoFrameService', () => ({
  extractVideoFrames: jest.fn(),
}));

const extractVideoFramesMock = jest.mocked(extractVideoFrames);

class VisionProvider extends BaseAIProvider {
  readonly provider = 'openai' as const;
  readonly capabilities = ['vision'];
  readonly analyzeImage = jest.fn(async (_image: Buffer, prompt?: string): Promise<ImageAnalysisResult> => ({
    analysis: prompt || 'frame',
    model: 'vision-test',
    usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
  }));
}

class TextOnlyProvider extends BaseAIProvider {
  readonly provider = 'freebuff' as const;
  readonly capabilities = ['text-generation'];
}

describe('BaseAIProvider video analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts frames, analyzes each frame, and aggregates usage', async () => {
    extractVideoFramesMock.mockResolvedValueOnce([Buffer.from('one'), Buffer.from('two')]);
    const provider = new VisionProvider();

    const result = await provider.analyzeVideo(Buffer.from('video'), 'Inspect crop health', {
      maxFrames: 2,
      frameInterval: 1,
    });

    expect(extractVideoFramesMock).toHaveBeenCalledWith(Buffer.from('video'), {
      maxFrames: 2,
      frameInterval: 1,
    });
    expect(provider.analyzeImage).toHaveBeenCalledTimes(2);
    expect(result.framesAnalyzed).toBe(2);
    expect(result.analysis).toContain('Frame 1: Inspect crop health');
    expect(result.analysis).toContain('Frame 2: Inspect crop health');
    expect(result.usage).toEqual({ promptTokens: 4, completionTokens: 6, totalTokens: 10 });
  });

  it('rejects video for providers without vision capability', async () => {
    await expect(new TextOnlyProvider().analyzeVideo(Buffer.from('video'))).rejects.toThrow(
      'does not support video analysis',
    );
    expect(extractVideoFramesMock).not.toHaveBeenCalled();
  });
});
