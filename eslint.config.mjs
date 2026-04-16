import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import jestPlugin from 'eslint-plugin-jest';
import prettier from 'eslint-plugin-prettier/recommended';
import promisePlugin from 'eslint-plugin-promise';
import sonarjs from 'eslint-plugin-sonarjs';
import testingLibrary from 'eslint-plugin-testing-library';
// eslint-disable-next-line import/namespace -- false positive: eslint-plugin-import cannot parse ESM `with` syntax in unicorn
import unicornPlugin from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  // ── Layer 1: Expo defaults (React, React Native, TypeScript, import rules) ──
  ...compat.extends('expo'),

  // ── Layer 2: Strict TypeScript rules (aligned with AGENTS.md) ──
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'unused-imports': unusedImports,
    },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ── Type Safety (AGENTS.md Rule 2: no casting, strict types) ──
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // ── Type-aware rules (require parserOptions.project) ──
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/array-type': ['warn', { default: 'array' }],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/consistent-type-assertions': 'warn',

      // ── Code Quality ──
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-redeclare': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
      ],

      // ── Disable base rules replaced by TS equivalents ──
      'no-shadow': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
    },
  },

  // ── Layer 2b: Promise hygiene for app/service code ──
  {
    ...promisePlugin.configs['flat/recommended'],
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs'],
    rules: {
      ...promisePlugin.configs['flat/recommended'].rules,
      'promise/always-return': 'off',
    },
  },

  // ── Layer 3: SonarJS recommended static analysis ──
  {
    ...sonarjs.configs.recommended,
    rules: {
      ...sonarjs.configs.recommended.rules,

      // ── Off: irrelevant to React Native (web server, cloud infra) ──
      'sonarjs/no-clear-text-protocols': 'off',
      'sonarjs/content-length': 'off',
      'sonarjs/cors': 'off',
      'sonarjs/csrf': 'off',
      'sonarjs/no-ip-forward': 'off',
      'sonarjs/x-powered-by': 'off',
      'sonarjs/certificate-transparency': 'off',
      'sonarjs/content-security-policy': 'off',
      'sonarjs/cookie-no-httponly': 'off',
      'sonarjs/cookies': 'off',
      'sonarjs/disabled-resource-integrity': 'off',
      'sonarjs/frame-ancestors': 'off',
      'sonarjs/insecure-cookie': 'off',
      'sonarjs/no-mime-sniff': 'off',
      'sonarjs/no-mixed-content': 'off',
      'sonarjs/no-referrer-policy': 'off',
      'sonarjs/strict-transport-security': 'off',
      'sonarjs/no-intrusive-permissions': 'off',

      // ── Off: overlap with existing rules ──
      'sonarjs/no-unused-vars': 'off', // covered by @typescript-eslint/no-unused-vars
      'sonarjs/unused-import': 'off', // covered by unused-imports/no-unused-imports

      // ── Off: too noisy/opinionated for iterative development ──
      'sonarjs/todo-tag': 'off',
      'sonarjs/fixme-tag': 'off',
      'sonarjs/no-commented-code': 'off',

      // ── Off: idiomatic React Native / hook patterns ──
      'sonarjs/no-nested-conditional': 'off', // nested ternaries are standard JSX
      'sonarjs/no-nested-functions': 'off', // callbacks inside hooks are unavoidable
      'sonarjs/no-small-switch': 'off', // small switches kept for extensibility
      'sonarjs/pseudo-random': 'off', // Math.random() for non-crypto IDs is safe

      // ── Tuned thresholds ──
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/prefer-read-only-props': 'warn',
    },
  },

  // ── Layer 3b: Unicorn modern JS best practices (cherry-picked) ──
  {
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/prefer-set-has': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/no-array-for-each': 'warn',
      'unicorn/prefer-number-properties': 'error',
      'unicorn/no-lonely-if': 'error',
      'unicorn/no-negated-condition': 'warn',
      'unicorn/prefer-string-replace-all': 'warn',
    },
  },

  // ── Layer 4b: Test-focused rules ──
  {
    ...jestPlugin.configs['flat/recommended'],
    files: ['**/__tests__/**/*.{ts,tsx,js,jsx}', '**/*.{test,spec}.{ts,tsx,js,jsx}'],
  },
  {
    ...testingLibrary.configs['flat/react'],
    files: ['**/__tests__/**/*.{ts,tsx,js,jsx}', '**/*.{test,spec}.{ts,tsx,js,jsx}'],
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      'testing-library/prefer-screen-queries': 'off',
    },
  },

  // ── Layer 4: General best practices ──
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
    },
  },

  // ── Layer 5: Prettier (as ESLint module, not standalone) ──
  prettier,
  {
    rules: {
      'prettier/prettier': [
        'error',
        {
          printWidth: 120,
          tabWidth: 2,
          singleQuote: true,
          bracketSameLine: true,
          trailingComma: 'all',
        },
      ],
    },
  },
];
