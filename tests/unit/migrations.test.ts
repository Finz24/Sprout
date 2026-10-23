import { describe, expect, it } from 'vitest';
import { migrationHistoryMatches } from '@sprout/database';

describe('committed migration history', () => {
  const committed = ['9e9b2cfec47519f49ee73cb533c459e22f8ca54fe5ba1cbec59f3d5883fe191c', '7069c7f97acc4c000dcd184757be1c65522723abe1eb2ef3e2b18730a78a0f4c'];

  it('accepts exactly the committed migrations in their committed order', () => {
    expect(
      migrationHistoryMatches(committed, [
        '9e9b2cfec47519f49ee73cb533c459e22f8ca54fe5ba1cbec59f3d5883fe191c',
        '7069c7f97acc4c000dcd184757be1c65522723abe1eb2ef3e2b18730a78a0f4c',
      ]),
    ).toBe(true);
  });

  it.each([
    ['an empty journal', []],
    ['a pending latest migration', ['9e9b2cfec47519f49ee73cb533c459e22f8ca54fe5ba1cbec59f3d5883fe191c']],
    [
      'a missing earlier migration with the same latest hash',
      ['7069c7f97acc4c000dcd184757be1c65522723abe1eb2ef3e2b18730a78a0f4c'],
    ],
    [
      'an edited earlier migration',
      ['edited-vector-hash', '7069c7f97acc4c000dcd184757be1c65522723abe1eb2ef3e2b18730a78a0f4c'],
    ],
    [
      'a different latest migration',
      ['9e9b2cfec47519f49ee73cb533c459e22f8ca54fe5ba1cbec59f3d5883fe191c', 'unexpected-latest-hash'],
    ],
    ['reordered migrations', ['7069c7f97acc4c000dcd184757be1c65522723abe1eb2ef3e2b18730a78a0f4c', '9e9b2cfec47519f49ee73cb533c459e22f8ca54fe5ba1cbec59f3d5883fe191c']],
    [
      'an additional applied migration',
      ['9e9b2cfec47519f49ee73cb533c459e22f8ca54fe5ba1cbec59f3d5883fe191c', '7069c7f97acc4c000dcd184757be1c65522723abe1eb2ef3e2b18730a78a0f4c', 'unknown-migration-hash'],
    ],
    [
      'a duplicate applied migration',
      ['9e9b2cfec47519f49ee73cb533c459e22f8ca54fe5ba1cbec59f3d5883fe191c', '9e9b2cfec47519f49ee73cb533c459e22f8ca54fe5ba1cbec59f3d5883fe191c', '7069c7f97acc4c000dcd184757be1c65522723abe1eb2ef3e2b18730a78a0f4c'],
    ],
  ] as const)('rejects %s', (_scenario, applied) => {
    expect(migrationHistoryMatches(committed, applied)).toBe(false);
  });

  it('does not declare an empty committed history ready', () => {
    expect(migrationHistoryMatches([], [])).toBe(false);
  });
});
