module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: true,
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^zod$': '<rootDir>/node_modules/zod',
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
  // otplib's @scure/* transitive deps ship ESM-only: transform them instead of
  // ignoring the whole node_modules tree.
  transformIgnorePatterns: ['/node_modules/(?!(@scure|@noble)/)'],
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
