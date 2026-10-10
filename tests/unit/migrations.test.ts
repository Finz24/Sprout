import { describe, expect, it } from 'vitest';
import { migrationHistoryMatches } from '@sprout/database';

describe('committed migration history', () => {
  const committed = ['enable-vector-hash', 'create-library-hash'];

  it('accepts exactly the committed migrations in their committed order', () => {
    expect(
      migrationHistoryMatches(committed, [
        'enable-vector-hash',
        'create-library-hash',
      ]),
    ).toBe(true);
  });

  it.each([
    ['an empty journal', []],
    ['a pending latest migration', ['enable-vector-hash']],
    [
      'a missing earlier migration with the same latest hash',
      ['create-library-hash'],
    ],
    [
      'an edited earlier migration',
      ['edited-vector-hash', 'create-library-hash'],
    ],
    [
      'a different latest migration',
      ['enable-vector-hash', 'unexpected-library-hash'],
    ],
    ['reordered migrations', ['create-library-hash', 'enable-vector-hash']],
    [
      'an additional applied migration',
      ['enable-vector-hash', 'create-library-hash', 'unknown-migration-hash'],
    ],
    [
      'a duplicate applied migration',
      ['enable-vector-hash', 'enable-vector-hash', 'create-library-hash'],
    ],
  ] as const)('rejects %s', (_scenario, applied) => {
    expect(migrationHistoryMatches(committed, applied)).toBe(false);
  });

  it('does not declare an empty committed history ready', () => {
    expect(migrationHistoryMatches([], [])).toBe(false);
  });
});
