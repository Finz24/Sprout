import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, test } from 'vitest';

const eslint = new ESLint({
  overrideConfig: tseslint.configs.disableTypeChecked,
});

describe('workspace architecture policy', () => {
  const probes = [
    {
      name: 'destructured builtin loaders cannot conceal dependencies',
      file: 'apps/api/src/policy.ts',
      source:
        "const { getBuiltinModule: load } = process; export const database = load('module').createRequire(import.meta.url)('@sprout/database');",
      rule: 'no-restricted-properties',
    },
    {
      name: 'computed module methods obey the ESM policy',
      file: 'apps/worker/src/policy.cts',
      source: "module['require']('@sprout/database');",
      rule: 'no-restricted-properties',
    },
    {
      name: 'aliased CommonJS globals cannot conceal dependencies',
      file: 'apps/api/src/policy.cts',
      source: "const load = require; load('@sprout/database');",
      rule: 'no-restricted-globals',
    },
    {
      name: 'aliased module globals cannot conceal dependencies',
      file: 'apps/api/src/policy.cts',
      source: "const loader = module; loader.require('@sprout/database');",
      rule: 'no-restricted-globals',
    },
    {
      name: 'builtin module loaders cannot bypass API ownership',
      file: 'apps/api/src/policy.ts',
      source:
        "export const database = process.getBuiltinModule('node:module').createRequire(import.meta.url)('@sprout/database');",
      rule: 'no-restricted-properties',
    },
    {
      name: 'CommonJS module methods cannot bypass worker ownership',
      file: 'apps/worker/src/policy.cjs',
      source: "module.require('@sprout/database');",
      rule: 'no-restricted-properties',
    },
    {
      name: 'dynamic Node imports cannot enter the browser',
      file: 'apps/web/src/policy.ts',
      source: "export const fs = import('node:fs');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'dynamic database drivers cannot enter browser JavaScript',
      file: 'apps/web/src/policy.js',
      source: "export const pg = import('pg');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'dynamic deep imports cannot bypass public exports',
      file: 'apps/api/src/policy.ts',
      source: "export const config = import('@sprout/runtime/src/config.js');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'computed module paths cannot conceal dependencies',
      file: 'apps/web/src/policy.ts',
      source: 'export const load = (name: string) => import(name);',
      rule: 'no-restricted-syntax',
    },
    {
      name: 'CommonJS imports cannot bypass ESM checks',
      file: 'apps/web/src/policy.js',
      source: "export const fs = require('fs');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'web cannot import database infrastructure',
      file: 'apps/web/src/policy.ts',
      source: "import '@sprout/database';",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'JavaScript cannot bring Node into the browser',
      file: 'apps/web/src/policy.js',
      source: "import 'node:fs';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'bare Node imports cannot enter contracts',
      file: 'packages/contracts/src/policy.ts',
      source: "import 'fs';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'inline import types cannot bypass dependency checks',
      file: 'apps/web/src/policy.ts',
      source: "export type Database = typeof import('@sprout/database');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'type declarations obey workspace boundaries',
      file: 'apps/web/src/policy.ts',
      source:
        "import type { Database } from '@sprout/database'; export type Value = Database;",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'deep imports cannot bypass public exports',
      file: 'apps/api/src/policy.ts',
      source: "import '@sprout/runtime/src/config.js';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'relative paths cannot cross project boundaries',
      file: 'apps/web/src/policy.ts',
      source: "import '../../../packages/database/src/index.js';",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'database cannot introduce a reverse dependency on runtime',
      file: 'packages/database/src/policy.ts',
      source: "import '@sprout/runtime';",
      rule: '@nx/enforce-module-boundaries',
    },
    ...['mts', 'cts', 'mjs', 'cjs', 'jsx', 'tsx'].map((extension) => ({
      name: `${extension} files obey workspace ownership`,
      file: `apps/api/src/policy.${extension}`,
      source: "import '@sprout/database';",
      rule: '@nx/enforce-module-boundaries',
    })),
    {
      name: 'package-root helpers obey workspace ownership',
      file: 'packages/ui/policy.ts',
      source: "import '@sprout/database';",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'package-root helpers remain browser-safe',
      file: 'packages/ui/policy.js',
      source: "import 'pg';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'disabling boundary rules inline has no effect',
      file: 'apps/api/src/policy.ts',
      source:
        "/* eslint-disable @nx/enforce-module-boundaries */\nimport '@sprout/database';",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'disabling browser restrictions inline has no effect',
      file: 'apps/web/src/policy.ts',
      source: "// eslint-disable-next-line\nimport 'pg';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'renamed module loaders cannot conceal database imports',
      file: 'apps/api/src/policy.ts',
      source:
        "import { createRequire as load } from 'node:module'; export const database = load(import.meta.url)('@sprout/database');",
      rule: 'no-restricted-imports',
    },
    {
      name: 'namespace module loaders cannot conceal imports',
      file: 'apps/worker/src/policy.ts',
      source:
        "import * as loader from 'module'; export const database = loader.createRequire(import.meta.url)('@sprout/database');",
      rule: 'no-restricted-imports',
    },
    {
      name: 'default module loaders cannot conceal imports',
      file: 'apps/api/src/policy.ts',
      source:
        "import loader from 'node:module'; export const database = loader.createRequire(import.meta.url)('@sprout/database');",
      rule: 'no-restricted-imports',
    },
    {
      name: 'dynamic module loaders cannot conceal imports',
      file: 'apps/api/src/policy.ts',
      source: "export const loader = import('node:module');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'forbidden workspace re-exports obey ownership',
      file: 'apps/api/src/policy.ts',
      source: "export { Database } from '@sprout/database';",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'forbidden type-only re-exports obey ownership',
      file: 'packages/ui/src/policy.ts',
      source: "export type { DatabaseSettings } from '@sprout/database';",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'server tooling cannot enter browser source',
      file: 'apps/web/src/policy.ts',
      source: "import 'drizzle-kit';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'server tooling cannot enter browser re-exports',
      file: 'packages/ui/src/policy.ts',
      source: "export * from 'vite';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'server tooling subpaths cannot enter dynamic imports',
      file: 'packages/contracts/src/policy.mts',
      source: "export const tooling = import('drizzle-kit/api');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'Nx tooling cannot enter browser source',
      file: 'apps/web/src/policy.ts',
      source: "import '@nx/devkit';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'config-like names in source remain browser-safe',
      file: 'apps/web/src/policy.config.ts',
      source: "import 'node:fs';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'Node environment globals cannot enter browser source',
      file: 'apps/web/src/policy.ts',
      source: 'export const secret = process.env.SECRET;',
      rule: 'no-restricted-globals',
    },
    {
      name: 'Node Buffer globals cannot enter shared UI',
      file: 'packages/ui/src/policy.ts',
      source: 'export const bytes = Buffer.from("text");',
      rule: 'no-restricted-globals',
    },
    {
      name: 'globalThis cannot conceal Node environment access',
      file: 'apps/web/src/policy.ts',
      source: 'export const secret = globalThis.process.env.SECRET;',
      rule: 'no-restricted-globals',
    },
    ...(
      [
        ['apps/web/src/policy.ts', "import '@sprout/ui';"],
        [
          'apps/web/src/policy.ts',
          "export { HealthApi } from '@sprout/contracts';",
        ],
        ['apps/api/src/policy.ts', "import '@sprout/runtime';"],
        ['apps/worker/src/policy.ts', "import '@sprout/runtime';"],
        ['packages/runtime/src/policy.ts', "import '@sprout/database';"],
        ['packages/runtime/src/policy.ts', "import '@sprout/contracts';"],
        ['packages/database/src/policy.ts', "import 'pg';"],
        [
          'apps/api/src/policy.ts',
          "export type { ComponentName } from '@sprout/contracts';",
        ],
        [
          'apps/web/src/policy.ts',
          "import type { ComponentName } from '@sprout/contracts'; export type Value = ComponentName;",
        ],
        ['apps/web/src/policy.mts', "export const ui = import('@sprout/ui');"],
        ['apps/web/src/policy.ts', 'export const mode = import.meta.env.MODE;'],
      ] satisfies [string, string][]
    ).map(([file, source]) => ({
      name: `allowed edge ${file} ${source}`,
      file,
      source,
      rule: null,
    })),
  ];

  test.each(probes)('$name', async ({ file, source, rule }) => {
    const results = await eslint.lintText(source, { filePath: file });
    const messages = results.flatMap((result) => result.messages);
    expect(results).toHaveLength(1);
    expect(results[0]?.fatalErrorCount).toBe(0);
    expect(
      messages.some((message) =>
        /^File ignored|^Parsing error|no matching configuration/i.test(
          message.message,
        ),
      ),
    ).toBe(false);
    if (rule === null) {
      expect(messages).toEqual([]);
    } else {
      expect(messages.map((message) => message.ruleId)).toContain(rule);
    }
  });

  test.each([
    [
      'apps/web/vite.config.ts',
      "import 'node:fs'; import 'vite'; export const port = process.env.PORT;",
    ],
    ['packages/database/drizzle.config.ts', "import 'drizzle-kit';"],
  ])('Node tooling remains allowed in %s', async (filePath, source) => {
    const results = await eslint.lintText(source, { filePath });
    expect(results.flatMap((result) => result.messages)).toEqual([]);
  });
});
