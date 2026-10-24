module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  globalSetup: '<rootDir>/src/tests/globalSetup.ts',
  setupFiles: ['<rootDir>/src/tests/jest.env.ts'],
  testTimeout: 30000,
};
