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
const nodeToolingFiles = [
  '*.config.{ts,mts,cts,js,mjs,cjs}',
  'apps/web/vite.config.{ts,mts,cts,js,mjs,cjs}',
  'packages/database/drizzle.config.{ts,mts,cts,js,mjs,cjs}',
];
const serverPackages = [
  'pg',
  'drizzle-orm',
  '@effect/platform-node',
  'pg-boss',
  'drizzle-kit',
  'nx',
  '@nx/devkit',
  '@nx/eslint-plugin',
  'eslint',
  '@eslint/js',
  'eslint-config-prettier',
  'typescript-eslint',
  'typescript',
  'tsx',
  'vite',
  'vitest',
  '@playwright/test',
  '@vitejs/plugin-react',
  '@tailwindcss/vite',
];
const browserImports = {
  group: [
    ...builtinModules,
    'node:*',
    ...serverPackages.flatMap((name) => [name, `${name}/*`]),
  ],
  message: 'Browser-safe modules cannot depend on server infrastructure.',
};
const nodeModuleImports = ['module', 'node:module'].map((name) => ({
  name,
  message: 'Use ESM imports; module loaders bypass workspace boundaries.',
}));
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
const serverPackagePattern = serverPackages
  .map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('/', '\\u002f'),
  )
  .join('|');
const moduleLoaderSyntax = {
  selector: 'ImportExpression[source.value=/^(node:)?module$/]',
  message: nodeModuleImports[0].message,
};
const browserImportSyntax = {
  selector: `ImportExpression[source.value=/^(node:|(?:${browserModulePattern})$|(?:${serverPackagePattern})(?:$|\\u002f))/]`,
  message: browserImports.message,
};
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.nx/**', '**/coverage/**'] },
  { linterOptions: { noInlineConfig: true } },
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
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: [
      'apps/*/src/**/*.{ts,tsx,mts,cts}',
      'packages/*/src/**/*.{ts,tsx,mts,cts}',
      'tests/**/*.{ts,tsx,mts,cts}',
      '*.config.{ts,mts,cts}',
      'apps/web/vite.config.{ts,mts,cts}',
      'packages/database/drizzle.config.{ts,mts,cts}',
    ],
    languageOptions: {
      parserOptions: {
        project: [
          './apps/*/tsconfig.json',
          './packages/*/tsconfig.json',
          './tsconfig.tools.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
    },
  },
  {
    files: [
      'apps/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      'packages/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
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
      'apps/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      'packages/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
    ],
    ignores: nodeToolingFiles,
    rules: {
      'no-restricted-globals': [
        'error',
        { globals: ['module', 'require'], checkGlobalObject: true },
      ],
      'no-restricted-properties': [
        'error',
        {
          property: 'getBuiltinModule',
          message:
            'Use ESM imports so workspace boundaries can validate dependencies.',
        },
        {
          object: 'module',
          property: 'require',
          message:
            'Use ESM imports so workspace boundaries can validate dependencies.',
        },
      ],
      'no-restricted-imports': [
        'error',
        { paths: nodeModuleImports, patterns: [publicImports] },
      ],
      'no-restricted-syntax': ['error', ...importSyntax, moduleLoaderSyntax],
    },
  },
  {
    files: [
      'apps/web/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      'packages/{ui,contracts}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
    ],
    ignores: nodeToolingFiles,
    rules: {
      'no-restricted-globals': [
        'error',
        {
          globals: ['process', 'Buffer', 'module', 'require'],
          checkGlobalObject: true,
        },
      ],
      'no-restricted-syntax': ['error', ...importSyntax, browserImportSyntax],
      'no-restricted-imports': [
        'error',
        { paths: nodeModuleImports, patterns: [publicImports, browserImports] },
      ],
    },
  },
  prettier,
);
