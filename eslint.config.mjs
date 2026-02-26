import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier/recommended';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  // ── Layer 1: Expo defaults (React, React Native, TypeScript, import rules) ──
  ...compat.extends('expo'),

  // ── Layer 2: Strict TypeScript rules (aligned with GEMINI.md) ──
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // ── Type Safety (GEMINI.md Rule 2: no casting, strict types) ──
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // ── Code Quality ──
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-redeclare': 'error',
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

  // ── Layer 3: General best practices ──
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

  // ── Layer 4: Prettier (as ESLint module, not standalone) ──
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
