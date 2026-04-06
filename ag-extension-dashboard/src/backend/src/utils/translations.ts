import fs from 'fs';
import path from 'path';

// Simple backend translation loader for English only
let translations: Record<string, string> = {};

export function loadTranslations(): void {
  try {
    // Try multiple possible paths since Docker build structure might differ
    const possiblePaths = [
      path.join(__dirname, '../../../frontend/public/locales/en.json'),
      path.join(__dirname, '../../../../frontend/public/locales/en.json'),
      path.join(process.cwd(), 'src/frontend/public/locales/en.json'),
      path.join(process.cwd(), 'frontend/public/locales/en.json'),
      '/app/frontend/public/locales/en.json'
    ];

    let translationData = null;
    let usedPath = '';

    for (const translationPath of possiblePaths) {
      try {
        if (fs.existsSync(translationPath)) {
          translationData = fs.readFileSync(translationPath, 'utf8');
          usedPath = translationPath;
          break;
        }
      } catch {
        continue;
      }
    }

    if (translationData) {
      translations = JSON.parse(translationData);
      console.log(`✅ Loaded ${Object.keys(translations).length} translations from ${usedPath}`);
    } else {
      console.warn('❌ Could not find translation file in any of these paths:');
      possiblePaths.forEach(p => console.warn(`  - ${p}`));
      translations = {};
    }
  } catch (error) {
    console.error('❌ Failed to load translations:', error);
    translations = {};
  }
}

export function t(key: string, defaultValue?: string): string {
  return translations[key] || defaultValue || key;
}