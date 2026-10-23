import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  writeExportPackage,
  type ExportSnapshot,
} from '../../packages/runtime/src/library-export/index.js';

const ORIGINAL_BYTES = Buffer.concat([
  Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x0d, 0x0a]),
  Buffer.from('Crème brûlée 🍮\r\nRâmen\r\n', 'utf8'),
  Buffer.from([0x00, 0x7f]),
]);
const ORIGINAL_SHA256 =
  '52d6ee39d04515d3d0d2c6276244aea18051eaa1c4b1fba4aebc8fec4c50d3c1';
const READABLE_NOTICE =
  'This is a readable export, not a disaster-recovery backup.';
const EXPECTED_COUNTS = {
  items: 2,
  libraryItems: 1,
  trashItems: 1,
  originals: 2,
  exportedOriginals: 1,
  missingOriginals: 1,
  spaces: 1,
  settings: 1,
};

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'sprout-export-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordOf(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected a JSON object');
  return value;
}

function arrayOf(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected a JSON array');
  return value;
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return recordOf(JSON.parse(await readFile(path, 'utf8')) as unknown);
}

async function readTree(
  directory: string,
  root = directory,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await readTree(path, root));
    } else if (entry.isFile()) {
      const relative = path.slice(root.length + 1).replaceAll('\\', '/');
      files[relative] = (await readFile(path)).toString('base64');
    }
  }
  return files;
}

function emptyRecords(): ExportSnapshot['items'][number]['records'] {
  return {
    originalInput: [],
    sourceMaterial: [],
    generatedUnderstanding: [],
    ownerCorrection: [],
    savingIntent: [],
    evidence: [],
    subject: [],
  };
}

async function createFixture(root: string): Promise<{
  snapshot: ExportSnapshot;
  destination: string;
}> {
  const sources = join(root, 'sources');
  await mkdir(sources, { recursive: true });
  const sourcePath = join(sources, 'ramen-original.bin');
  await writeFile(sourcePath, ORIGINAL_BYTES);
  const destination = join(root, 'export');
  const snapshot: ExportSnapshot = {
    ownerId: 'owner-1',
    items: [
      {
        id: 'item-recipe',
        title: 'Ramen à la maison',
        location: 'library',
        records: {
          originalInput: [
            {
              id: 'input-1',
              data: {
                text: 'Saved from a reel',
                url: 'https://example.test/reel/1',
              },
            },
          ],
          sourceMaterial: [
            {
              id: 'source-1',
              data: { caption: 'The caption shown with the reel.' },
            },
          ],
          generatedUnderstanding: [
            {
              id: 'gen-1',
              data: {
                summary: 'A quick ramen recipe.',
                ingredients: ['noodles', 'broth'],
              },
            },
          ],
          ownerCorrection: [
            {
              id: 'correction-1',
              corrects: 'gen-1',
              field: 'summary',
              data: { summary: 'A 20-minute ramen recipe.' },
            },
          ],
          savingIntent: [
            { id: 'intent-1', data: { intent: 'Cook this on Friday.' } },
          ],
          evidence: [
            {
              id: 'evidence-1',
              data: { supports: 'summary', source: 'captured reel' },
            },
          ],
          subject: [
            { id: 'subject-1', data: { name: 'Ramen' } },
            { id: 'subject-2', data: { name: 'Friday dinner' } },
          ],
        },
        originals: [
          {
            kind: 'available',
            id: 'original-1',
            name: 'ramen-original.bin',
            sourcePath,
          },
          {
            kind: 'missing',
            id: 'original-2',
            name: 'ramen-video.mp4',
            reason: 'the source video was not retained',
          },
        ],
      },
      {
        id: 'item-ticket',
        title: 'Concert ticket',
        location: 'trash',
        records: emptyRecords(),
        originals: [],
      },
    ],
    spaces: [
      {
        id: 'space-1',
        name: 'Friday dinners',
        memberships: [{ itemId: 'item-recipe' }],
        viewPreferences: [
          { name: 'arrangement', data: { mode: 'grid', sort: 'added' } },
        ],
      },
    ],
    settings: [{ name: 'appearance', data: { theme: 'dark' } }],
    omissions: [
      {
        scope: 'reminders',
        reason: 'Reminders are outside readable export v1.',
      },
    ],
  };
  return { snapshot, destination };
}

async function rejectWithoutOutput(
  root: string,
  destination: string,
  snapshot: ExportSnapshot,
  forbiddenText: readonly string[],
): Promise<void> {
  const entriesBefore = (await readdir(root)).sort();
  let failure: unknown;
  try {
    await writeExportPackage(snapshot, destination);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  for (const text of forbiddenText) {
    expect(String(failure)).not.toContain(text);
  }
  expect(existsSync(destination)).toBe(false);
  const entriesAfter = (await readdir(root)).sort();
  expect(entriesAfter).toEqual(entriesBefore);
  expect(entriesAfter.some((entry) => entry.includes('.partial-'))).toBe(false);
}

describe('readable export package v1', () => {
  it('exports labelled records, originals and gaps that survive outside Sprout', async () => {
    const root = await temporaryDirectory();
    const { snapshot, destination } = await createFixture(root);

    const report = await writeExportPackage(snapshot, destination);

    expect(report.formatVersion).toBe(1);
    expect(report.destination).toBe(destination);
    expect(report.complete).toBe(false);
    expect(report.counts).toEqual(EXPECTED_COUNTS);

    expect(Object.keys(await readTree(destination)).sort()).toEqual([
      'README.txt',
      'items/000001/item.json',
      'items/000001/item.md',
      'items/000002/item.json',
      'items/000002/item.md',
      'manifest.json',
      'originals/000001.bin',
      'settings.json',
      'spaces.json',
    ]);

    const manifest = await readJson(join(destination, 'manifest.json'));
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.trashIncluded).toBe(true);
    expect(manifest.notice).toBe(READABLE_NOTICE);
    expect(manifest.counts).toEqual(EXPECTED_COUNTS);
    expect(manifest.omissions).toEqual([
      {
        scope: 'reminders',
        reason: 'Reminders are outside readable export v1.',
      },
    ]);
    expect(manifest.missingOriginals).toEqual([
      {
        itemId: 'item-recipe',
        originalId: 'original-2',
        name: 'ramen-video.mp4',
      },
    ]);
    expect(manifest.partialFailures).toEqual([
      {
        itemId: 'item-recipe',
        originalId: 'original-2',
        reason: 'the source video was not retained',
      },
    ]);

    const item = await readJson(join(destination, 'items/000001/item.json'));
    expect(item.id).toBe('item-recipe');
    expect(item.title).toBe('Ramen à la maison');
    expect(item.location).toBe('library');

    const records = recordOf(item.records);
    const originalInput = recordOf(arrayOf(records.originalInput)[0]);
    expect(originalInput.label).toBe('original input');
    expect(originalInput.id).toBe('input-1');
    expect(recordOf(originalInput.data).text).toBe('Saved from a reel');

    const sourceMaterial = recordOf(arrayOf(records.sourceMaterial)[0]);
    expect(sourceMaterial.label).toBe('source material');
    expect(recordOf(sourceMaterial.data).caption).toBe(
      'The caption shown with the reel.',
    );

    const generated = recordOf(arrayOf(records.generatedUnderstanding)[0]);
    expect(generated.label).toBe('generated understanding');
    expect(recordOf(generated.data).summary).toBe('A quick ramen recipe.');

    const correction = recordOf(arrayOf(records.ownerCorrection)[0]);
    expect(correction.label).toBe('owner correction');
    expect(correction.corrects).toBe('gen-1');
    expect(correction.field).toBe('summary');
    expect(recordOf(correction.data).summary).toBe('A 20-minute ramen recipe.');

    const intent = recordOf(arrayOf(records.savingIntent)[0]);
    expect(intent.label).toBe('saving intent');
    expect(recordOf(intent.data).intent).toBe('Cook this on Friday.');

    const evidence = recordOf(arrayOf(records.evidence)[0]);
    expect(evidence.label).toBe('evidence');
    expect(recordOf(evidence.data).source).toBe('captured reel');

    const subjects = arrayOf(records.subject).map(recordOf);
    expect(subjects.map((record) => record.label)).toEqual([
      'subject',
      'subject',
    ]);
    expect(subjects.map((record) => recordOf(record.data).name)).toEqual([
      'Ramen',
      'Friday dinner',
    ]);

    const originals = arrayOf(item.originals).map(recordOf);
    expect(originals.map((original) => original.label)).toEqual([
      'original file',
      'original file',
    ]);
    expect(originals[0]).toMatchObject({
      id: 'original-1',
      name: 'ramen-original.bin',
      file: 'originals/000001.bin',
    });
    expect(originals[1]).toMatchObject({
      id: 'original-2',
      name: 'ramen-video.mp4',
      missing: true,
      reason: 'the source video was not retained',
    });
    expect(originals[1]?.file).toBeUndefined();

    const marked = await readFile(
      join(destination, 'items/000001/item.md'),
      'utf8',
    );
    expect(marked).toContain('# Ramen à la maison');
    expect(marked).toContain('Generated understanding');
    expect(marked).toContain('Owner correction');
    expect(marked).toContain('A quick ramen recipe.');
    expect(marked).toContain('A 20-minute ramen recipe.');
    expect(marked).toContain('gen-1');
    expect(marked).toContain('summary');
    expect(marked).toContain('ramen-video.mp4');
    expect(marked).toContain('the source video was not retained');

    const trashItem = await readJson(
      join(destination, 'items/000002/item.json'),
    );
    expect(trashItem.id).toBe('item-ticket');
    expect(trashItem.title).toBe('Concert ticket');
    expect(trashItem.location).toBe('trash');

    const spaces = await readJson(join(destination, 'spaces.json'));
    const space = recordOf(arrayOf(spaces.spaces)[0]);
    expect(space.id).toBe('space-1');
    expect(space.name).toBe('Friday dinners');
    const membership = recordOf(arrayOf(space.memberships)[0]);
    expect(membership.label).toBe('membership');
    expect(membership.itemId).toBe('item-recipe');
    const viewPreference = recordOf(arrayOf(space.viewPreferences)[0]);
    expect(viewPreference.label).toBe('view preference');
    expect(viewPreference.name).toBe('arrangement');
    expect(recordOf(viewPreference.data)).toEqual({
      mode: 'grid',
      sort: 'added',
    });

    const settings = await readJson(join(destination, 'settings.json'));
    const setting = recordOf(arrayOf(settings.settings)[0]);
    expect(setting.label).toBe('setting');
    expect(setting.name).toBe('appearance');
    expect(recordOf(setting.data)).toEqual({ theme: 'dark' });

    const readme = await readFile(join(destination, 'README.txt'), 'utf8');
    expect(readme).toContain('readable export');
    expect(readme).toContain('not a disaster-recovery backup');
    expect(readme).toContain('items/NNNNNN/item.json');
    expect(readme).toContain('originals/NNNNNN.bin');
    expect(readme).toContain('Owner corrections take precedence');
    expect(readme).toContain('ramen-video.mp4');
    expect(readme).toContain('Reminders are outside readable export v1.');

    const original = await readFile(join(destination, 'originals/000001.bin'));
    expect(original.equals(ORIGINAL_BYTES)).toBe(true);
    expect(createHash('sha256').update(original).digest('hex')).toBe(
      ORIGINAL_SHA256,
    );
  });
});

const CREDENTIAL_KEYS = [
  'token',
  'secret',
  'password',
  'cookie',
  'apiKey',
  'session',
  'ACCESS_TOKEN',
  'api-key',
  'pass_word',
  'Session',
] as const;

describe('credential rejection', () => {
  it.each(CREDENTIAL_KEYS)(
    'rejects credential-like field %s before writing',
    async (key) => {
      const root = await temporaryDirectory();
      const { snapshot, destination } = await createFixture(root);
      const contaminated = Object.assign({}, snapshot, {
        settings: [
          {
            name: 'appearance',
            data: { nested: [{ [key]: 'not-a-real-secret' }] },
          },
        ],
        extraMetadata: { nested: [{ [key]: 'not-a-real-secret' }] },
      });

      await rejectWithoutOutput(root, destination, contaminated, [
        'not-a-real-secret',
        key,
      ]);
    },
  );

  it.each([
    ['setting', 'session'],
    ['view preference', 'api_key'],
  ] as const)('rejects a credential-like %s name', async (kind, name) => {
    const root = await temporaryDirectory();
    const { snapshot, destination } = await createFixture(root);
    const contaminated: ExportSnapshot =
      kind === 'setting'
        ? { ...snapshot, settings: [{ name, data: { value: 1 } }] }
        : {
            ...snapshot,
            spaces: [
              {
                id: 'space-1',
                name: 'Friday dinners',
                memberships: [],
                viewPreferences: [{ name, data: { value: 1 } }],
              },
            ],
          };

    await rejectWithoutOutput(root, destination, contaminated, [name]);
  });
});

const UNPRESERVABLE_DATA: readonly (readonly [string, () => unknown])[] = [
  ['function value', () => ({ value: () => 'not-preserved' })],
  ['undefined value', () => ({ value: undefined })],
  [
    'cyclic value',
    () => {
      const cycle: Record<string, unknown> = {};
      cycle.self = cycle;
      return cycle;
    },
  ],
  [
    'accessor value',
    () => {
      const value: Record<string, unknown> = {};
      Object.defineProperty(value, 'reported', {
        enumerable: true,
        get: () => 'not-preserved',
      });
      return value;
    },
  ],
];

describe('data the package cannot preserve faithfully', () => {
  it.each(UNPRESERVABLE_DATA)(
    'rejects %s before writing',
    async (_label, createData) => {
      const root = await temporaryDirectory();
      const { snapshot, destination } = await createFixture(root);
      const contaminated: ExportSnapshot = {
        ...snapshot,
        settings: [{ name: 'appearance', data: createData() }],
      };

      await rejectWithoutOutput(root, destination, contaminated, [
        'not-preserved',
      ]);
    },
  );
});

describe('atomic publication', () => {
  it('rejects a failed original copy without publishing or leaving staging', async () => {
    const root = await temporaryDirectory();
    const sources = join(root, 'sources');
    await mkdir(sources, { recursive: true });
    const validSource = join(sources, 'valid.bin');
    await writeFile(validSource, ORIGINAL_BYTES);
    const directorySource = join(root, 'directory-source');
    await mkdir(directorySource);
    const destination = join(root, 'export');
    const snapshot: ExportSnapshot = {
      ownerId: 'owner-1',
      items: [
        {
          id: 'first',
          title: 'First item',
          location: 'library',
          records: emptyRecords(),
          originals: [
            {
              kind: 'available',
              id: 'first-original',
              name: 'valid.bin',
              sourcePath: validSource,
            },
          ],
        },
        {
          id: 'second',
          title: 'Second item',
          location: 'library',
          records: emptyRecords(),
          originals: [
            {
              kind: 'available',
              id: 'second-original',
              name: 'directory-source',
              sourcePath: directorySource,
            },
          ],
        },
      ],
      spaces: [],
      settings: [],
      omissions: [],
    };

    let failure: unknown;
    try {
      await writeExportPackage(snapshot, destination);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain('directory-source');
    expect(existsSync(destination)).toBe(false);
    expect((await readdir(root)).sort()).toEqual([
      'directory-source',
      'sources',
    ]);
    expect((await lstat(directorySource)).isDirectory()).toBe(true);
    expect(await readFile(validSource)).toEqual(ORIGINAL_BYTES);
  });
});

describe('export completeness', () => {
  it('reports an omitted scope as incomplete even when no original is missing', async () => {
    const root = await temporaryDirectory();
    const destination = join(root, 'export');
    const report = await writeExportPackage(
      {
        ownerId: 'owner-1',
        items: [],
        spaces: [],
        settings: [],
        omissions: [{ scope: 'source comments', reason: 'Not retained.' }],
      },
      destination,
    );
    expect(report.complete).toBe(false);
    expect(
      (await readJson(join(destination, 'manifest.json'))).omissions,
    ).toEqual([{ scope: 'source comments', reason: 'Not retained.' }]);
  });
});

describe('input immutability', () => {
  it('leaves the snapshot deep-equal after writing', async () => {
    const root = await temporaryDirectory();
    const { snapshot, destination } = await createFixture(root);
    const before = structuredClone(snapshot);

    await writeExportPackage(snapshot, destination);

    expect(snapshot).toEqual(before);
  });
});

describe('fresh destinations', () => {
  it('refuses to replace an existing destination', async () => {
    const root = await temporaryDirectory();
    const { snapshot, destination } = await createFixture(root);
    await writeExportPackage(snapshot, destination);
    const published = await readTree(destination);
    const entriesBefore = (await readdir(root)).sort();

    let failure: unknown;
    try {
      await writeExportPackage(snapshot, destination);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain(destination);
    expect(String(failure)).not.toContain('Ramen');
    expect(Object.keys(await readTree(destination)).length).toBeGreaterThan(0);
    expect(await readTree(destination)).toEqual(published);
    expect((await readdir(root)).sort()).toEqual(entriesBefore);
    expect(
      (await readdir(root)).some((name) => name.includes('.partial-')),
    ).toBe(false);
  });
});
