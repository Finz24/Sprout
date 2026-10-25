import { Schema } from 'effect';
import { describe, expect, test } from 'vitest';
import { TextSubmission, LiteralQuery, LibraryPage } from '@sprout/contracts';

const submissionId = 'a0b54c2a-c76b-4dd7-a56c-16fd6c7d9480';
const parse = Schema.decodeUnknownSync(TextSubmission);

describe('text submission contract', () => {
  test('preserves exact Unicode, line endings, whitespace and separate intent', () => {
    const originalText = '  שלום 🍋 é e\u0301\r\n\n"schedule a reminder"  ';
    const savingIntent = '  Keep the original\r\n  ';
    expect(parse({ submissionId, originalText, savingIntent })).toEqual({
      submissionId,
      originalText,
      savingIntent,
    });
  });

  test.each([
    '',
    ' \r\n\t',
    '\u0000x',
    '\ud800',
    '\udc00',
    'x'.repeat(65537),
    '🍋'.repeat(16385),
  ])('rejects unsupported or over-limit original input', (originalText) => {
    expect(() =>
      parse({ submissionId, originalText, savingIntent: null }),
    ).toThrow();
  });

  test('accepts byte limits exactly and preserves API empty intent', () => {
    expect(
      parse({
        submissionId,
        originalText: '🍋'.repeat(16384),
        savingIntent: 'é'.repeat(2048),
      }).originalText.length,
    ).toBe(32768);
    expect(
      parse({ submissionId, originalText: 'x', savingIntent: '' }).savingIntent,
    ).toBe('');
  });

  test.each(['é'.repeat(2049), '\u0000', '\ud800'])(
    'rejects unsupported intent',
    (savingIntent) => {
      expect(() =>
        parse({ submissionId, originalText: 'x', savingIntent }),
      ).toThrow();
    },
  );

  test('requires explicit nullable intent and UUID identity', () => {
    expect(() => parse({ submissionId, originalText: 'x' })).toThrow();
    expect(() =>
      parse({
        submissionId: 'owner-controlled',
        originalText: 'x',
        savingIntent: null,
      }),
    ).toThrow();
  });

  test('keeps wildcard and combining search characters literal while bounding queries', () => {
    const query = Schema.decodeUnknownSync(LiteralQuery);
    expect(query('%_\\ e\u0301')).toBe('%_\\ e\u0301');
    expect(() => query('')).toThrow();
    expect(() => query('x'.repeat(501))).toThrow();
    const page = Schema.decodeUnknownSync(LibraryPage);
    expect(() => page({ cursor: null, limit: 51 })).toThrow();
    expect(() =>
      page({
        cursor: {
          retainedAt: '2026-02-31T00:00:00.000Z',
          itemId: submissionId,
        },
        limit: 50,
      }),
    ).toThrow();
  });
});
