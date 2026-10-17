import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

const eslint = new ESLint();

describe('typed lint safety policy', () => {
  const probes = [
    {
      name: 'unhandled promises in API source',
      file: 'apps/api/src/main.ts',
      source: 'Promise.resolve(1);',
      rule: '@typescript-eslint/no-floating-promises',
    },
    {
      name: 'promise callbacks where callers expect void',
      file: 'apps/web/src/main.tsx',
      source:
        'export const run: () => void = async () => { await Promise.resolve(); };',
      rule: '@typescript-eslint/no-misused-promises',
    },
    {
      name: 'unsafe JSON assignments in worker source',
      file: 'apps/worker/src/main.ts',
      source: 'export const data = JSON.parse("{}");',
      rule: '@typescript-eslint/no-unsafe-assignment',
    },
    {
      name: 'type assertions cannot conceal unvalidated JSON',
      file: 'apps/api/src/main.ts',
      source:
        'export const name = (JSON.parse("{}") as { name: string }).name;',
      rule: '@typescript-eslint/no-unsafe-type-assertion',
    },
    {
      name: 'non-null assertions cannot discard missing input',
      file: 'apps/worker/src/main.ts',
      source:
        'export function upper(value: string | undefined) { return value!.toUpperCase(); }',
      rule: '@typescript-eslint/no-non-null-assertion',
    },
    {
      name: 'unsafe calls in runtime source',
      file: 'packages/runtime/src/index.ts',
      source: 'JSON.parse("{}")();',
      rule: '@typescript-eslint/no-unsafe-call',
    },
    {
      name: 'unsafe member access in UI source',
      file: 'packages/ui/src/index.ts',
      source: 'export const name = JSON.parse("{}").name;',
      rule: '@typescript-eslint/no-unsafe-member-access',
    },
    {
      name: 'unsafe return values in contracts',
      file: 'packages/contracts/src/index.ts',
      source: 'export function parse(): string { return JSON.parse("{}"); }',
      rule: '@typescript-eslint/no-unsafe-return',
    },
    {
      name: 'unsafe arguments in database source',
      file: 'packages/database/src/index.ts',
      source:
        'const trim = (value: string) => value.trim(); export const name = trim(JSON.parse("{}"));',
      rule: '@typescript-eslint/no-unsafe-argument',
    },
    {
      name: 'test code also handles its promises',
      file: 'tests/unit/health.test.ts',
      source: 'Promise.resolve();',
      rule: '@typescript-eslint/no-floating-promises',
    },
    {
      name: 'inline disables cannot suppress typed safety',
      file: 'apps/api/src/main.ts',
      source:
        '/* eslint-disable @typescript-eslint/no-unsafe-assignment */\nexport const data = JSON.parse("{}");',
      rule: '@typescript-eslint/no-unsafe-assignment',
    },
    {
      name: 'awaited promises remain allowed',
      file: 'apps/api/src/main.ts',
      source: 'export async function run() { await Promise.resolve(); }',
      rule: null,
    },
    {
      name: 'const assertions preserve valid literal types',
      file: 'packages/contracts/src/index.ts',
      source: 'export const state = { kind: "ready" } as const;',
      rule: null,
    },
    {
      name: 'rejections handled with catch remain allowed',
      file: 'apps/web/src/main.tsx',
      source: 'Promise.resolve().catch(() => {});',
      rule: null,
    },
    {
      name: 'JSON narrowed from unknown remains allowed',
      file: 'packages/contracts/src/index.ts',
      source:
        'const data: unknown = JSON.parse("null"); export const name = typeof data === "string" ? data.trim() : "unknown";',
      rule: null,
    },
  ];

  test.each(probes)(
    '$name',
    async ({ file, source, rule }) => {
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
    },
    30_000,
  );

  test.each(['apps/web/vite.config.ts', 'packages/database/drizzle.config.ts'])(
    'Node tooling is typed in %s',
    async (filePath) => {
      const results = await eslint.lintText('Promise.resolve();', { filePath });
      expect(results[0]?.fatalErrorCount).toBe(0);
      expect(
        results.flatMap((result) =>
          result.messages.map((message) => message.ruleId),
        ),
      ).toContain('@typescript-eslint/no-floating-promises');
    },
  );
});
