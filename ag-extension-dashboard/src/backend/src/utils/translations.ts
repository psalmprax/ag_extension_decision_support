import fs from 'fs';
import path from 'path';

// Simple backend translation loader for English only
let translations: Record<string, string> = {};

export function loadTranslations(): void {
  try {
    const translationPath = path.join(__dirname, '../../../frontend/public/locales/en.json');
    const translationData = fs.readFileSync(translationPath, 'utf8');
    translations = JSON.parse(translationData);
  } catch (error) {
    console.warn('Failed to load translations:', error);
    translations = {};
  }
}

export function t(key: string, defaultValue?: string): string {
  return translations[key] || defaultValue || key;
}