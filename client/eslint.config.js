// ESLint configuration for the client. This is how docs/CodingStandard.md
// section 4 ("run linting before committing") is enforced: npm run lint, and
// the same command runs in CI on every pull request.
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*'],
  },
]);
