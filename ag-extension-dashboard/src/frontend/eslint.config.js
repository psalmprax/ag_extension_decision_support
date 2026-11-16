// ESLint 10 flat config — a 1:1 port of the former .eslintrc.cjs.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

export default tseslint.config(
    // Parity with the old `--ext ts,tsx` + ignorePatterns: only TypeScript was
    // linted, and eslintrc skipped dot-directories by default (flat config does not).
    { ignores: ['dist/**', 'coverage/**', '**/*.{js,cjs,mjs}', '.*/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'unused-imports': unusedImports,
            sonarjs,
        },
        rules: {
            // The two classic rules that plugin v4's `recommended` enabled. v7's
            // `recommended` also adds React Compiler rules, a separate decision.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            'unused-imports/no-unused-imports': 'warn',
            'sonarjs/cognitive-complexity': ['error', 15],
        },
    },
);
