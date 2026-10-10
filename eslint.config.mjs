import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import nx from '@nx/eslint-plugin';
import { createProjectGraphAsync } from '@nx/devkit';
import { builtinModules } from 'node:module';

// The Nx rule reads this cache; fail instead of silently skipping boundaries.
await createProjectGraphAsync({ exitOnError: false });

const publicImports = {
  group: ['@sprout/*/*'],
  message: 'Import workspace packages through their public exports.',
};
const browserImports = {
  group: [
    ...builtinModules,
    'node:*',
    'pg',
    'pg/*',
    'drizzle-orm',
    'drizzle-orm/*',
    '@effect/platform-node',
    '@effect/platform-node/*',
    'pg-boss',
    'pg-boss/*',
  ],
  message: 'Browser-safe modules cannot depend on server infrastructure.',
};
const importSyntax = [
  {
    selector: 'TSImportType',
    message:
      'Use import type declarations so workspace boundaries can validate dependencies.',
  },
  {
    selector: 'ImportExpression[source.type!="Literal"]',
    message:
      'Use literal module paths so workspace boundaries can validate dependencies.',
  },
  {
    selector: 'CallExpression[callee.name="require"]',
    message:
      'Use ESM imports so workspace boundaries can validate dependencies.',
  },
  {
    selector:
      'ImportExpression[source.value=/^@sprout\\u002f[^\\u002f]+\\u002f/]',
    message: publicImports.message,
  },
];
const browserModulePattern = builtinModules
  .map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('/', '\\u002f'),
  )
  .join('|');
const browserImportSyntax = {
  selector: `ImportExpression[source.value=/^(node:|(?:${browserModulePattern})$|(?:pg|drizzle-orm|pg-boss)(?:$|\\u002f)|@effect\\u002fplatform-node(?:$|\\u002f))/]`,
  message: browserImports.message,
};
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.nx/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    files: [
      'apps/**/*.{ts,tsx,js,jsx,mjs,cjs}',
      'packages/**/src/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    ],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          depConstraints: [
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:ui', 'scope:contracts'],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:runtime', 'scope:contracts'],
            },
            {
              sourceTag: 'scope:worker',
              onlyDependOnLibsWithTags: ['scope:runtime', 'scope:contracts'],
            },
            {
              sourceTag: 'scope:runtime',
              onlyDependOnLibsWithTags: ['scope:database', 'scope:contracts'],
            },
            { sourceTag: 'scope:database', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'scope:contracts', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'scope:ui', onlyDependOnLibsWithTags: [] },
          ],
        },
      ],
      'no-restricted-imports': ['error', { patterns: [publicImports] }],
      'no-restricted-syntax': ['error', ...importSyntax],
    },
  },
  {
    files: [
      'apps/web/**/*.{ts,tsx,js,jsx,mjs,cjs}',
      'packages/{ui,contracts}/src/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...importSyntax, browserImportSyntax],
      'no-restricted-imports': [
        'error',
        { patterns: [publicImports, browserImports] },
      ],
    },
  },
  prettier,
);
