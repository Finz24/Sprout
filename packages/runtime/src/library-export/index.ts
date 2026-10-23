import { copyFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ExportRecord {
  readonly id: string;
  readonly data: unknown;
}

export interface OwnerCorrection extends ExportRecord {
  readonly corrects: string;
  readonly field: string;
}

export interface ExportRecordGroups {
  readonly originalInput: readonly ExportRecord[];
  readonly sourceMaterial: readonly ExportRecord[];
  readonly generatedUnderstanding: readonly ExportRecord[];
  readonly ownerCorrection: readonly OwnerCorrection[];
  readonly savingIntent: readonly ExportRecord[];
  readonly evidence: readonly ExportRecord[];
  readonly subject: readonly ExportRecord[];
}

export type ExportOriginal =
  | {
      readonly kind: 'available';
      readonly id: string;
      readonly name: string;
      readonly sourcePath: string;
    }
  | {
      readonly kind: 'missing';
      readonly id: string;
      readonly name: string;
      readonly reason: string;
    };

export interface ExportItem {
  readonly id: string;
  readonly title: string;
  readonly location: 'library' | 'trash';
  readonly records: ExportRecordGroups;
  readonly originals: readonly ExportOriginal[];
}

export interface ExportMembership {
  readonly itemId: string;
}

export interface ExportViewPreference {
  readonly name: string;
  readonly data: unknown;
}

export interface ExportSpace {
  readonly id: string;
  readonly name: string;
  readonly memberships: readonly ExportMembership[];
  readonly viewPreferences: readonly ExportViewPreference[];
}

export interface ExportSetting {
  readonly name: string;
  readonly data: unknown;
}

export interface ExportOmission {
  readonly scope: string;
  readonly reason: string;
}

export interface ExportSnapshot {
  readonly ownerId: string;
  readonly items: readonly ExportItem[];
  readonly spaces: readonly ExportSpace[];
  readonly settings: readonly ExportSetting[];
  readonly omissions: readonly ExportOmission[];
}

export interface ExportCounts {
  readonly items: number;
  readonly libraryItems: number;
  readonly trashItems: number;
  readonly originals: number;
  readonly exportedOriginals: number;
  readonly missingOriginals: number;
  readonly spaces: number;
  readonly settings: number;
}

export interface ExportReport {
  readonly formatVersion: 1;
  readonly destination: string;
  readonly complete: boolean;
  readonly counts: ExportCounts;
}

const FORMAT_VERSION = 1;
const NOTICE = 'This is a readable export, not a disaster-recovery backup.';
const CREDENTIAL_TERMS = [
  'token',
  'secret',
  'password',
  'cookie',
  'apikey',
  'session',
] as const;

const LABELS = {
  originalInput: 'original input',
  sourceMaterial: 'source material',
  generatedUnderstanding: 'generated understanding',
  ownerCorrection: 'owner correction',
  savingIntent: 'saving intent',
  evidence: 'evidence',
  subject: 'subject',
} as const;

interface OutputRecord {
  readonly label: string;
  readonly id: string;
  readonly data: unknown;
}

interface OutputCorrection extends OutputRecord {
  readonly label: 'owner correction';
  readonly corrects: string;
  readonly field: string;
}

type OutputOriginal =
  | {
      readonly label: 'original file';
      readonly id: string;
      readonly name: string;
      readonly file: string;
    }
  | {
      readonly label: 'original file';
      readonly id: string;
      readonly name: string;
      readonly missing: true;
      readonly reason: string;
    };

interface ItemJson {
  readonly id: string;
  readonly title: string;
  readonly location: 'library' | 'trash';
  readonly records: {
    readonly originalInput: readonly OutputRecord[];
    readonly sourceMaterial: readonly OutputRecord[];
    readonly generatedUnderstanding: readonly OutputRecord[];
    readonly ownerCorrection: readonly OutputCorrection[];
    readonly savingIntent: readonly OutputRecord[];
    readonly evidence: readonly OutputRecord[];
    readonly subject: readonly OutputRecord[];
  };
  readonly originals: readonly OutputOriginal[];
}

interface CopyPlan {
  readonly sourcePath: string;
  readonly file: string;
}

interface MissingOriginal {
  readonly itemId: string;
  readonly originalId: string;
  readonly name: string;
}

interface PartialFailure {
  readonly itemId: string;
  readonly originalId: string;
  readonly reason: string;
}

interface BuiltItem {
  readonly json: ItemJson;
  readonly markdown: string;
}

interface BuiltPackage {
  readonly items: readonly BuiltItem[];
  readonly copies: readonly CopyPlan[];
  readonly missingOriginals: readonly MissingOriginal[];
  readonly partialFailures: readonly PartialFailure[];
}

interface ExportManifest {
  readonly formatVersion: 1;
  readonly ownerId: string;
  readonly notice: string;
  readonly counts: ExportCounts;
  readonly trashIncluded: true;
  readonly omissions: readonly ExportOmission[];
  readonly missingOriginals: readonly MissingOriginal[];
  readonly partialFailures: readonly PartialFailure[];
}

function ordinal(index: number): string {
  return index.toString().padStart(6, '0');
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isCredentialName(value: string): boolean {
  const normalized = normalizedName(value);
  return CREDENTIAL_TERMS.some((term) => normalized.includes(term));
}

function assertNoCredentialFields(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const name of Object.getOwnPropertyNames(value)) {
    if (isCredentialName(name)) {
      throw new Error('Export rejected: credential-like field name.');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor === undefined) continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new Error('Export rejected: accessor property.');
    }
    const child: unknown = descriptor.value;
    assertNoCredentialFields(child, seen);
  }
}

function assertNoCredentialLogicalNames(snapshot: ExportSnapshot): void {
  for (const setting of snapshot.settings) {
    if (isCredentialName(setting.name)) {
      throw new Error('Export rejected: credential-like field name.');
    }
  }
  for (const space of snapshot.spaces) {
    for (const preference of space.viewPreferences) {
      if (isCredentialName(preference.name)) {
        throw new Error('Export rejected: credential-like field name.');
      }
    }
  }
}

function withLabel(label: string, record: ExportRecord): OutputRecord {
  return { label, id: record.id, data: record.data };
}

function buildPackage(snapshot: ExportSnapshot): BuiltPackage {
  const items: BuiltItem[] = [];
  const copies: CopyPlan[] = [];
  const missingOriginals: MissingOriginal[] = [];
  const partialFailures: PartialFailure[] = [];
  let originalIndex = 0;

  for (const item of snapshot.items) {
    const originals: OutputOriginal[] = item.originals.map((original) => {
      if (original.kind === 'missing') {
        missingOriginals.push({
          itemId: item.id,
          originalId: original.id,
          name: original.name,
        });
        partialFailures.push({
          itemId: item.id,
          originalId: original.id,
          reason: original.reason,
        });
        return {
          label: 'original file',
          id: original.id,
          name: original.name,
          missing: true,
          reason: original.reason,
        };
      }
      originalIndex += 1;
      const file = `originals/${ordinal(originalIndex)}.bin`;
      copies.push({ sourcePath: original.sourcePath, file });
      return {
        label: 'original file',
        id: original.id,
        name: original.name,
        file,
      };
    });

    const json: ItemJson = {
      id: item.id,
      title: item.title,
      location: item.location,
      records: {
        originalInput: item.records.originalInput.map((record) =>
          withLabel(LABELS.originalInput, record),
        ),
        sourceMaterial: item.records.sourceMaterial.map((record) =>
          withLabel(LABELS.sourceMaterial, record),
        ),
        generatedUnderstanding: item.records.generatedUnderstanding.map(
          (record) => withLabel(LABELS.generatedUnderstanding, record),
        ),
        ownerCorrection: item.records.ownerCorrection.map((record) => ({
          label: LABELS.ownerCorrection,
          id: record.id,
          corrects: record.corrects,
          field: record.field,
          data: record.data,
        })),
        savingIntent: item.records.savingIntent.map((record) =>
          withLabel(LABELS.savingIntent, record),
        ),
        evidence: item.records.evidence.map((record) =>
          withLabel(LABELS.evidence, record),
        ),
        subject: item.records.subject.map((record) =>
          withLabel(LABELS.subject, record),
        ),
      },
      originals,
    };

    items.push({ json, markdown: renderItemMarkdown(json) });
  }

  return { items, copies, missingOriginals, partialFailures };
}

function renderItemMarkdown(item: ItemJson): string {
  const lines: string[] = [
    `# ${item.title}`,
    '',
    `- Item ID: ${item.id}`,
    `- Location: ${item.location}`,
    '',
  ];
  const sections: readonly (readonly [
    string,
    readonly (OutputRecord | OutputCorrection)[],
  ])[] = [
    ['Original input', item.records.originalInput],
    ['Source material', item.records.sourceMaterial],
    ['Generated understanding', item.records.generatedUnderstanding],
    ['Owner correction', item.records.ownerCorrection],
    ['Saving intent', item.records.savingIntent],
    ['Evidence', item.records.evidence],
    ['Subject', item.records.subject],
  ];

  for (const [heading, records] of sections) {
    if (records.length === 0) continue;
    lines.push(`## ${heading}`, '');
    for (const record of records) {
      lines.push(`- Label: ${record.label}`);
      lines.push(`- ID: ${record.id}`);
      if ('corrects' in record) {
        lines.push(`- Corrects: ${record.corrects} (field ${record.field})`);
        lines.push(
          '- Owner correction takes precedence over generated understanding.',
        );
      }
      lines.push('- Data:', '', '```json');
      lines.push(JSON.stringify(record.data, null, 2));
      lines.push('```', '');
      if (record.label === LABELS.generatedUnderstanding) {
        const corrections = item.records.ownerCorrection.filter(
          (correction) => correction.corrects === record.id,
        );
        if (corrections.length > 0) {
          lines.push(
            `- Superseded by owner correction: ${corrections
              .map(
                (correction) => `${correction.id} (field ${correction.field})`,
              )
              .join(', ')}.`,
            '',
          );
        }
      }
    }
  }

  if (item.originals.length > 0) {
    lines.push('## Original files', '');
    for (const original of item.originals) {
      lines.push(`- Label: ${original.label}`);
      lines.push(`- ID: ${original.id}`);
      lines.push(`- Name: ${original.name}`);
      if ('file' in original) {
        lines.push(`- File: ${original.file}`);
      } else {
        lines.push(`- Missing: ${original.reason}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function renderReadme(snapshot: ExportSnapshot, built: BuiltPackage): string {
  const gaps = [
    '- Trash: included.',
    ...(built.missingOriginals.length === 0
      ? ['- Missing originals: none.']
      : built.missingOriginals.map(
          (original) =>
            `- Missing original: ${original.name} (${original.originalId}) on item ${original.itemId}.`,
        )),
    ...(built.partialFailures.length === 0
      ? ['- Partial failures: none.']
      : built.partialFailures.map(
          (failure) =>
            `- Partial failure: item ${failure.itemId}, original ${failure.originalId}: ${failure.reason}.`,
        )),
    ...(snapshot.omissions.length === 0
      ? ['- Omissions: none.']
      : snapshot.omissions.map(
          (omission) => `- Omission: ${omission.scope}: ${omission.reason}`,
        )),
  ];

  return `Sprout readable export
======================

${NOTICE}

Owner: ${snapshot.ownerId}
Format version: ${FORMAT_VERSION}

This folder is a readable export. You can open it without Sprout. It is output-only and Sprout does not import it.

Contents
--------
- manifest.json: counts, Trash inclusion, omissions, missing originals and partial failures.
- items/NNNNNN/item.json: one saved item with labelled records and original file references.
- items/NNNNNN/item.md: the same item in Markdown.
- originals/NNNNNN.bin: an original file copied byte for byte.
- spaces.json: Spaces, memberships and view preferences.
- settings.json: exported settings.

Record labels
-------------
Every record carries a label: original input, source material, generated understanding, owner correction, saving intent, evidence, subject, membership, view preference, setting.
Owner corrections take precedence over generated understanding. The export keeps both and never overwrites the generated value.

Gaps in this package
--------------------
${gaps.join('\n')}

Limits
------
${NOTICE}
It does not contain a database backup, a schema migration, credentials, or a way to recover material after Trash is purged. A complete records-and-media backup and a tested restore are separate work.
`;
}

function countPackage(snapshot: ExportSnapshot): ExportCounts {
  let libraryItems = 0;
  let trashItems = 0;
  let originals = 0;
  let exportedOriginals = 0;
  let missingOriginals = 0;
  for (const item of snapshot.items) {
    if (item.location === 'library') libraryItems += 1;
    else trashItems += 1;
    for (const original of item.originals) {
      originals += 1;
      if (original.kind === 'available') exportedOriginals += 1;
      else missingOriginals += 1;
    }
  }
  return {
    items: snapshot.items.length,
    libraryItems,
    trashItems,
    originals,
    exportedOriginals,
    missingOriginals,
    spaces: snapshot.spaces.length,
    settings: snapshot.settings.length,
  };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function writeExportPackage(
  snapshot: ExportSnapshot,
  destination: string,
): Promise<ExportReport> {
  assertNoCredentialFields(snapshot, new Set());
  assertNoCredentialLogicalNames(snapshot);
  const counts = countPackage(snapshot);
  const built = buildPackage(snapshot);
  const manifest: ExportManifest = {
    formatVersion: 1,
    ownerId: snapshot.ownerId,
    notice: NOTICE,
    counts,
    trashIncluded: true,
    omissions: snapshot.omissions,
    missingOriginals: built.missingOriginals,
    partialFailures: built.partialFailures,
  };
  const spaces = snapshot.spaces.map((space) => ({
    id: space.id,
    name: space.name,
    memberships: space.memberships.map((membership) => ({
      label: 'membership' as const,
      itemId: membership.itemId,
    })),
    viewPreferences: space.viewPreferences.map((preference) => ({
      label: 'view preference' as const,
      name: preference.name,
      data: preference.data,
    })),
  }));
  const settings = snapshot.settings.map((setting) => ({
    label: 'setting' as const,
    name: setting.name,
    data: setting.data,
  }));

  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'manifest.json'), json(manifest), 'utf8');
  await writeFile(
    join(destination, 'README.txt'),
    renderReadme(snapshot, built),
    'utf8',
  );
  for (let index = 0; index < built.items.length; index += 1) {
    const item = built.items[index];
    if (item === undefined) continue;
    const directory = join(destination, 'items', ordinal(index + 1));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'item.json'), json(item.json), 'utf8');
    await writeFile(join(directory, 'item.md'), item.markdown, 'utf8');
  }
  await writeFile(join(destination, 'spaces.json'), json({ spaces }), 'utf8');
  await writeFile(
    join(destination, 'settings.json'),
    json({ settings }),
    'utf8',
  );
  if (built.copies.length > 0) {
    await mkdir(join(destination, 'originals'), { recursive: true });
  }
  for (const copy of built.copies) {
    const stat = await lstat(copy.sourcePath);
    if (!stat.isFile()) {
      throw new Error(
        'Export failed: an original source is not a regular file.',
      );
    }
    await copyFile(copy.sourcePath, join(destination, copy.file));
  }

  return {
    formatVersion: 1,
    destination,
    complete: counts.missingOriginals === 0,
    counts,
  };
}
