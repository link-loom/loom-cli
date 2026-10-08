export default {
  testEnvironment: 'node',
  transform: {},
  roots: ['<rootDir>/packages', '<rootDir>/scripts'],
  testMatch: ['<rootDir>/packages/*/tests/**/*.test.js', '<rootDir>/scripts/tests/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/fixtures/'],
};
