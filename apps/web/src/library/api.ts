import { Schema } from 'effect';
import {
  SaveReceipt,
  SavedTextItem,
  SavedTextPage,
  TextSubmission,
  type LibraryCursor,
  type SaveReceipt as SaveReceiptValue,
  type SavedTextItem as SavedTextItemValue,
  type SavedTextPage as SavedTextPageValue,
  type TextSubmission as TextSubmissionValue,
} from '@sprout/contracts';
import { session } from '../session.js';

export type LibraryFailureKind =
  'conflict' | 'invalid' | 'missing' | 'unavailable';

export class LibraryFailure extends Error {
  constructor(readonly kind: LibraryFailureKind) {
    super(kind);
    this.name = 'LibraryFailure';
  }
}

function failure(status: number): LibraryFailure {
  if (status === 400) return new LibraryFailure('invalid');
  if (status === 404) return new LibraryFailure('missing');
  if (status === 409) return new LibraryFailure('conflict');
  return new LibraryFailure('unavailable');
}

function parse<A>(decode: (input: unknown) => A, body: unknown): A {
  try {
    return decode(body);
  } catch {
    throw new LibraryFailure('unavailable');
  }
}

export function freezeSubmission(
  submission: TextSubmissionValue,
): TextSubmissionValue {
  return Object.freeze(Schema.decodeUnknownSync(TextSubmission)(submission));
}

export async function saveText(
  submission: TextSubmissionValue,
): Promise<SaveReceiptValue> {
  const { response, body } = await session.privateRequest('/api/library/text', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submission),
  });
  if (!response.ok) throw failure(response.status);
  const receipt = parse(Schema.decodeUnknownSync(SaveReceipt), body);
  if (receipt.submissionId !== submission.submissionId)
    throw new LibraryFailure('unavailable');
  return receipt;
}

function pagePath(path: string, limit = 50, cursor?: LibraryCursor) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', JSON.stringify(cursor));
  return `${path}?${query.toString()}`;
}

export async function listText(
  cursor?: LibraryCursor,
): Promise<SavedTextPageValue> {
  const { response, body } = await session.privateRequest(
    pagePath('/api/library/items', 50, cursor),
  );
  if (!response.ok) throw failure(response.status);
  return parse(Schema.decodeUnknownSync(SavedTextPage), body);
}

export async function searchText(
  queryText: string,
  cursor?: LibraryCursor,
): Promise<SavedTextPageValue> {
  const params = new URLSearchParams({ q: queryText, limit: '50' });
  if (cursor) params.set('cursor', JSON.stringify(cursor));
  const { response, body } = await session.privateRequest(
    `/api/library/search?${params.toString()}`,
  );
  if (!response.ok) throw failure(response.status);
  return parse(Schema.decodeUnknownSync(SavedTextPage), body);
}

export async function getText(itemId: string): Promise<SavedTextItemValue> {
  const { response, body } = await session.privateRequest(
    `/api/library/items/${encodeURIComponent(itemId)}`,
  );
  if (!response.ok) throw failure(response.status);
  const item = parse(Schema.decodeUnknownSync(SavedTextItem), body);
  if (item.itemId !== itemId) throw new LibraryFailure('unavailable');
  return item;
}

export function displayRetentionTime(retainedAt: string) {
  const date = new Date(retainedAt);
  return Number.isNaN(date.valueOf())
    ? retainedAt
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}
