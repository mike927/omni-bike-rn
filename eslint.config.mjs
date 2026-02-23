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
  ...compat.extends('expo'),
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
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
