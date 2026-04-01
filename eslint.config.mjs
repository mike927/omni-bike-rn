import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import jestPlugin from 'eslint-plugin-jest';
import prettier from 'eslint-plugin-prettier/recommended';
import promisePlugin from 'eslint-plugin-promise';
import sonarjs from 'eslint-plugin-sonarjs';
import testingLibrary from 'eslint-plugin-testing-library';
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
    rules: {
      // ── Type Safety (AGENTS.md Rule 2: no casting, strict types) ──
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

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

  // ── Layer 3: Local Sonar-style static analysis (no server/account required) ──
  {
    plugins: {
      sonarjs,
    },
    rules: {
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-dead-store': 'error',
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
