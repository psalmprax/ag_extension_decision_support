// Side-effect CSS imports (entrypoints import '../../assets/index.css') need a
// module declaration for TypeScript 7, which enforces declarations where TS 5
// silently allowed them. No styles are shipped from this file.
declare module '*.css';
