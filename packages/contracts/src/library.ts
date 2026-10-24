import { Schema } from 'effect';

export const SubmissionId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand('SubmissionId'),
);
export type SubmissionId = typeof SubmissionId.Type;
export const SavedItemId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand('SavedItemId'),
);
export type SavedItemId = typeof SavedItemId.Type;

const scalarText = Schema.makeFilter<string>(
  (value) =>
    (!value.includes('\u0000') &&
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      )) ||
    'Text must contain Unicode scalar values without NUL',
);
const utf8Bytes = (value: string) => {
  let bytes = 0;
  for (const character of value) {
    const code = character.charCodeAt(0);
    bytes += character.length === 2 ? 4 : code < 128 ? 1 : code < 2048 ? 2 : 3;
  }
  return bytes;
};
export const OriginalText = Schema.String.check(
  scalarText,
  Schema.makeFilter(
    (value) =>
      (value.trim().length > 0 && utf8Bytes(value) <= 65536) ||
      'Enter text containing at most 64 KiB of UTF-8',
  ),
);
export const SavingIntent = Schema.NullOr(
  Schema.String.check(
    scalarText,
    Schema.makeFilter(
      (value) =>
        utf8Bytes(value) <= 4096 ||
        'Saving intent must contain at most 4 KiB of UTF-8',
    ),
  ),
);
export const TextSubmission = Schema.Struct({
  submissionId: SubmissionId,
  originalText: OriginalText,
  savingIntent: SavingIntent,
});
export type TextSubmission = typeof TextSubmission.Type;
const RetainedAt = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === `${value.slice(0, 23)}Z`,
  ),
);
export const SaveReceipt = Schema.Struct({
  submissionId: SubmissionId,
  itemId: SavedItemId,
  retainedAt: RetainedAt,
  retained: Schema.Literal('text'),
});
export type SaveReceipt = typeof SaveReceipt.Type;
export const SavedTextItem = Schema.Struct({
  ...SaveReceipt.fields,
  originalText: OriginalText,
  submittedIntent: SavingIntent,
  review: Schema.Literal('New'),
  understanding: Schema.Literal('Not started'),
  lifecycle: Schema.Literal('live'),
  actions: Schema.Literal('Not scheduled'),
});
export type SavedTextItem = typeof SavedTextItem.Type;
export const LibraryCursor = Schema.Struct({
  retainedAt: RetainedAt,
  itemId: SavedItemId,
});
export type LibraryCursor = typeof LibraryCursor.Type;
export const LibraryPage = Schema.Struct({
  cursor: Schema.NullOr(LibraryCursor),
  limit: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 50 }),
  ),
});
export type LibraryPage = typeof LibraryPage.Type;
export const LiteralQuery = Schema.String.check(
  scalarText,
  Schema.isMinLength(1),
  Schema.isMaxLength(500),
);
export type LiteralQuery = typeof LiteralQuery.Type;
export const SavedTextPage = Schema.Struct({
  items: Schema.Array(SavedTextItem),
  nextCursor: Schema.NullOr(LibraryCursor),
});
export type SavedTextPage = typeof SavedTextPage.Type;
