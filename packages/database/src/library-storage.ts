import { randomUUID } from 'node:crypto';
import { Data, Effect, Schema } from 'effect';
import type { Pool } from 'pg';
import {
  SavedTextItem,
  type SaveReceipt,
  type SavedItemId,
  type TextSubmission,
  type LibraryPage,
  type LiteralQuery,
  type SavedTextPage,
} from '@sprout/contracts';
import { privateOperation, Unavailable } from './private-storage.js';

export class SubmissionConflict extends Data.TaggedError(
  'SubmissionConflict',
) {}
export class NotFound extends Data.TaggedError('NotFound') {}

// Keep PostgreSQL's microseconds in receipts and cursors so keyset pagination is exact.
const columns = `id AS "itemId", submission_id AS "submissionId",
  to_char(retained_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "retainedAt",
  original_text AS "originalText", submitted_intent AS "submittedIntent"`;
const item = (row: unknown) =>
  Schema.decodeUnknownSync(SavedTextItem)(
    typeof row === 'object' && row !== null
      ? {
          ...row,
          retained: 'text',
          review: 'New',
          understanding: 'Not started',
          lifecycle: 'live',
          actions: 'Not scheduled',
        }
      : row,
  );
const receipt = (row: SavedTextItem): SaveReceipt => ({
  itemId: row.itemId,
  submissionId: row.submissionId,
  retainedAt: row.retainedAt,
  retained: row.retained,
});

export const libraryOperations = (pool: Pool) => {
  const page = (input: LibraryPage, query: LiteralQuery | null) =>
    privateOperation(pool, async (client): Promise<SavedTextPage> => {
      const result = await client.query(
        `SELECT ${columns} FROM private.saved_item
      WHERE ($1::timestamptz IS NULL OR (retained_at,id) < ($1::timestamptz,$2::uuid))
        AND ($3::text IS NULL OR strpos(original_text COLLATE "C", $3 COLLATE "C") > 0)
      ORDER BY retained_at DESC,id DESC LIMIT $4`,
        [
          input.cursor?.retainedAt ?? null,
          input.cursor?.itemId ?? null,
          query,
          input.limit + 1,
        ],
      );
      const items = result.rows.slice(0, input.limit).map(item);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          result.rows.length > input.limit && last
            ? { retainedAt: last.retainedAt, itemId: last.itemId }
            : null,
      };
    });
  return {
    saveText: (input: TextSubmission) =>
      privateOperation(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO private.saved_item
        (id,owner_user_id,submission_id,original_text,submitted_intent)
        VALUES ($1,private.current_owner_id(),$2,$3,$4)
        ON CONFLICT (owner_user_id,submission_id) DO NOTHING RETURNING ${columns}`,
          [
            randomUUID(),
            input.submissionId,
            input.originalText,
            input.savingIntent,
          ],
        );
        let row: unknown = inserted.rows[0];
        if (!row) {
          // A new READ COMMITTED statement sees the competing committed insert.
          const existing = await client.query(
            `SELECT ${columns} FROM private.saved_item WHERE submission_id=$1`,
            [input.submissionId],
          );
          row = existing.rows[0];
        }
        if (!row) throw new Unavailable();
        const retained = item(row);
        return retained.originalText === input.originalText &&
          retained.submittedIntent === input.savingIntent
          ? { kind: 'Retained' as const, retained }
          : { kind: 'Conflict' as const };
      }).pipe(
        Effect.flatMap((decision) =>
          decision.kind === 'Retained'
            ? Effect.succeed(receipt(decision.retained))
            : Effect.fail(new SubmissionConflict()),
        ),
      ),
    get: (id: SavedItemId) =>
      privateOperation(pool, async (client) => {
        const result = await client.query(
          `SELECT ${columns} FROM private.saved_item WHERE id=$1`,
          [id],
        );
        return result.rows[0] ? item(result.rows[0]) : null;
      }).pipe(
        Effect.flatMap((row) =>
          row ? Effect.succeed(row) : Effect.fail(new NotFound()),
        ),
      ),
    list: (input: LibraryPage) => page(input, null),
    searchOriginal: (query: LiteralQuery, input: LibraryPage) =>
      page(input, query),
  };
};
