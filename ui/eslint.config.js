// eslint.config.js
import plugin from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.{ts,tsx}'], // files to apply this config to
    ignores: [], // no files to ignore
    languageOptions: {
      parser,
      ecmaVersion: 2020, // or the version you're using
      sourceType: 'module',
      globals: {
        // These are the Node.js global variables
        __filename: true,
        __dirname: true,
        require: true,
        process: true,
        Buffer: true,
        // You can add more if needed
      },
    },
    plugins: {
      '@typescript-eslint': plugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
    },
  },
];