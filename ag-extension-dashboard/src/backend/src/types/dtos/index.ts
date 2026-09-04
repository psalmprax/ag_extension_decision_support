/**
 * API DTOs (camelCase) + row→DTO mapping functions.
 *
 * Domain split of the former `types/dtos.ts` (pure move, no logic change).
 * Each DTO mirrors a row type from `../rowTypes.ts` but uses camelCase
 * property names (matching the API response shape the frontend expects).
 *
 * This barrel re-exports every domain module so existing
 * `import ... from '@/types/dtos'` imports keep working unchanged
 * (TypeScript resolves `@/types/dtos` to this `index.ts` via `baseUrl`).
 */
export * from './farmer';
export * from './visit';
export * from './knowledge';
export * from './chat';
export * from './billing';
