import { z } from 'zod';
import { Tool } from './types';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';

const translationSchema = z.object({
  text: z.string().describe('Text to translate'),
  targetLanguage: z.string().describe('Target language code (sw, fr, es, lug, oro, zu, ar, hi, etc.)'),
  sourceLanguage: z.string().optional().describe('Source language code (auto-detect if omitted)'),
  context: z.string().optional().describe('Context for better translation (e.g., agriculture, medical, technical)'),
});

export const translationTool: Tool<typeof translationSchema> = {
  name: 'translate_text',
  description: 'Translates text between languages using AI-powered context-aware translation. Supports agricultural terminology and local languages (Swahili, Luganda, Oromo, Zulu, Arabic, Hindi, French, Spanish). Use when communicating with farmers in their preferred language.',
  schema: translationSchema,
  execute: async ({ text, targetLanguage, sourceLanguage, context }) => {
    try {
      const provider = await AIProviderFactory.getProvider();
      const langNames: Record<string, string> = {
        en: 'English', sw: 'Swahili', fr: 'French', es: 'Spanish', de: 'German',
        lug: 'Luganda', oro: 'Oromo', zu: 'Zulu', ar: 'Arabic', hi: 'Hindi',
        ru: 'Russian', zh: 'Chinese', pt: 'Portuguese', am: 'Amharic',
      };

      const sourceName = sourceLanguage ? (langNames[sourceLanguage] || sourceLanguage) : 'auto-detect';
      const targetName = langNames[targetLanguage] || targetLanguage;
      const contextNote = context ? `\nContext: ${context}` : '';

      const systemPrompt = `You are a professional translator specializing in agricultural and rural development terminology. Translate accurately while preserving cultural context and local expressions.`;

      const userPrompt = `Translate the following text from ${sourceName} to ${targetName}.${contextNote}

IMPORTANT:
- Preserve agricultural terminology accuracy
- Use locally appropriate expressions
- Keep numbers, dates, and measurements unchanged
- If a term has no direct translation, provide the closest equivalent with a brief explanation

Text to translate:
${text}

Provide ONLY the translation, nothing else.`;

      const response = await provider.generateText([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { temperature: 0.1, maxTokens: 2000 });

      return JSON.stringify({
        original: text,
        translated: response.text,
        sourceLanguage: sourceName,
        targetLanguage: targetName,
        context: context || null,
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: 'Translation failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
