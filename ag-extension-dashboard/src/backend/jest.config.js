module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: true,
  // Ancestor lookup first; the backend's node_modules only as a fallback
  // (modulePaths is searched AFTER the hierarchy). As a moduleDirectories entry
  // it outranked every ancestor, so in the workspace install CI uses, root-hoisted
  // groq-sdk (needs CJS node-fetch v2) resolved the backend-local ESM-only
  // node-fetch v3 and every suite importing it failed. The fallback still lets
  // files outside the backend (ag-extension-shared) find backend-installed deps.
  moduleDirectories: ['node_modules'],
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
    // ESM-only allowlisted node_modules (see transformIgnorePatterns): transpile to CJS.
    '^.+\\.js$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        allowJs: true,
      },
    ],
  },
  // otplib's @scure/* and @noble/* transitive deps ship ESM-only: transform them instead of
  // ignoring the whole node_modules tree — including copies nested under another
  // package (e.g. @otplib/plugin-crypto-noble/node_modules/@noble/hashes), which
  // correct module resolution loads in the standalone backend install.
  transformIgnorePatterns: ['/node_modules/(?!(?:.*/node_modules/)?(?:@scure|@noble)/)'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  // v8 provider: babel-plugin-istanbul crashes on this tree
  // (`test-exclude` calls ESM-only minimatch v9 as a function).
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
    '!src/utils/logger.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
};
