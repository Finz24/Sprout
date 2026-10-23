import { describe, expect, it } from 'vitest';
import { migrationHistoryMatches } from '@sprout/database';

describe('committed migration history', () => {
  const committed = ['vector-fixture-hash', 'auth-fixture-hash'];

  it('accepts exactly the committed migrations in their committed order', () => {
    expect(
      migrationHistoryMatches(committed, [
        'vector-fixture-hash',
        'auth-fixture-hash',
      ]),
    ).toBe(true);
  });

  it.each([
    ['an empty journal', []],
    ['a pending latest migration', ['vector-fixture-hash']],
    [
      'a missing earlier migration with the same latest hash',
      ['auth-fixture-hash'],
    ],
    [
      'an edited earlier migration',
      ['edited-vector-hash', 'auth-fixture-hash'],
    ],
    [
      'a different latest migration',
      ['vector-fixture-hash', 'unexpected-latest-hash'],
    ],
    ['reordered migrations', ['auth-fixture-hash', 'vector-fixture-hash']],
    [
      'an additional applied migration',
      ['vector-fixture-hash', 'auth-fixture-hash', 'unknown-migration-hash'],
    ],
    [
      'a duplicate applied migration',
      ['vector-fixture-hash', 'vector-fixture-hash', 'auth-fixture-hash'],
    ],
  ] as const)('rejects %s', (_scenario, applied) => {
    expect(migrationHistoryMatches(committed, applied)).toBe(false);
  });

  it('does not declare an empty committed history ready', () => {
    expect(migrationHistoryMatches([], [])).toBe(false);
  });
});
