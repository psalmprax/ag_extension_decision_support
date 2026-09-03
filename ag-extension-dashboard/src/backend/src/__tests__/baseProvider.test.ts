import { BaseAIProvider } from '../services/aiProvider/types';

// Minimal concrete subclass with NO capability overrides: every default must
// fail loudly ("does not support") so the provider fallback chain
// (AIProviderFactory.getWithFallback) can try the next provider. Silent empty
// results would look like success and corrupt downstream answers.
class BareProvider extends BaseAIProvider {
  readonly provider = 'huggingface' as const;
  readonly capabilities: string[] = [];
}

describe('BaseAIProvider unsupported-capability defaults', () => {
  it.each([
    ['generateText', () => new BareProvider().generateText([{ role: 'user', content: 'hi' }])],
    ['streamText', async () => { const gen = new BareProvider().streamText('hi'); await gen.next(); }],
    ['createEmbedding', () => new BareProvider().createEmbedding('maize')],
    ['createBatchEmbeddings', () => new BareProvider().createBatchEmbeddings(['a'])],
    ['speechToText', () => new BareProvider().speechToText(Buffer.from('x'))],
    ['textToSpeech', () => new BareProvider().textToSpeech('hello')],
    ['analyzeWithReasoning', () => new BareProvider().analyzeWithReasoning('ctx', 'q')],
    ['classify', () => new BareProvider().classify('text', { taxonomy: 'crop' })],
    ['analyzeImage', () => new BareProvider().analyzeImage(Buffer.from('x'), 'describe')],
  ])('%s rejects explicitly instead of returning a silent empty result', async (_name, fn) => {
    await expect((fn as () => Promise<unknown>)()).rejects.toThrow(/does not support/);
  });
});
