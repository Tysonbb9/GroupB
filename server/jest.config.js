// Better Auth ships ES modules (.mjs). Jest runs CommonJS, so ts-jest also
// turns Better Auth's JavaScript into CommonJS, which means node_modules has
// to be transformed too (transformIgnorePatterns: []).
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.m?js$': ['ts-jest', { tsconfig: { allowJs: true, module: 'commonjs' } }],
  },
  transformIgnorePatterns: [],
  // Signing up hashes the password, which is slow on purpose, and a test that
  // reloads the app loads Better Auth again. 5 seconds is too tight for both.
  testTimeout: 20_000,
};
