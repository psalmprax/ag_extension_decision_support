// ESLint 10 flat config — a 1:1 port of the former .eslintrc.json.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

export default tseslint.config(
    // The lint script only targets src/**/*.ts; keep generated output out.
    { ignores: ['dist/**', 'coverage/**', 'src/shared-api/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 2021,
            globals: { ...globals.node, ...globals.es2021 },
        },
        plugins: { sonarjs },
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-console': 'off',
            'sonarjs/cognitive-complexity': 'warn',
        },
    },
);
