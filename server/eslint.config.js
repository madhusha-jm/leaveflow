// `npm run lint` — catches whole bug classes (unused variables, typos in names,
// unreachable code) before a reviewer has to. CI runs it on every pull request.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['coverage/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      // Express tells error handlers apart by their 4 parameters, so an unused
      // `next` (or req/res) is required, not a mistake.
      'no-unused-vars': ['error', { argsIgnorePattern: '^(_|req|res|next)$' }],
    },
  },
  { files: ['tests/**'], languageOptions: { globals: globals.jest } },
];
