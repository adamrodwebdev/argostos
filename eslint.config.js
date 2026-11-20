import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import oxlint from 'eslint-plugin-oxlint';
import tseslint from 'typescript-eslint';

/** Hidden time and chance: only the platform adapters may read the real clock (the user's rule). */
const HIDDEN_TIME_AND_CHANCE = [
  { object: 'Math', property: 'random', message: 'Inject a seeded RandomSource instead.' },
  { object: 'Date', property: 'now', message: 'Inject the clock; logic counts fixed steps.' },
  { object: 'performance', property: 'now', message: 'Only src/platform reads the real clock.' },
];

/** Coercing readers: outside numbers go through rules/input.ts (`parseNumber`, `readNumber`). */
const COERCING_READERS = [
  { name: 'parseInt', message: 'Use parseNumber from rules/input.ts.' },
  { name: 'parseFloat', message: 'Use parseNumber from rules/input.ts.' },
  { name: 'isNaN', message: 'Use Number.isFinite on a value already read as a number.' },
];

export default defineConfig(
  {
    ignores: ['dist/**', 'coverage/**', 'test-results/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // `noUncheckedIndexedAccess` is on: `!` marks typed-array indexes the loop proves valid.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/prefer-readonly': 'error',
      'no-restricted-globals': ['error', ...COERCING_READERS],
      'no-restricted-properties': [
        'error',
        { object: 'Number', property: 'parseInt', message: 'Use parseNumber.' },
        { object: 'Number', property: 'parseFloat', message: 'Use parseNumber.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Inject the clock; logic counts fixed steps.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/platform/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...HIDDEN_TIME_AND_CHANCE,
        { object: 'Number', property: 'parseInt', message: 'Use parseNumber.' },
        { object: 'Number', property: 'parseFloat', message: 'Use parseNumber.' },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
);
