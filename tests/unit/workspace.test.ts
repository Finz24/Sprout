import { readdirSync } from 'node:fs';
import { createProjectGraphAsync } from '@nx/devkit';
import { describe, expect, test } from 'vitest';

const graph = await createProjectGraphAsync({ exitOnError: false });
const projects = Object.values(graph.nodes);
const platforms = {
  web: 'browser',
  ui: 'browser',
  contracts: 'shared',
  api: 'server',
  worker: 'server',
  runtime: 'server',
  database: 'server',
};

describe('workspace ownership', () => {
  test.each(['apps', 'packages'])(
    'every %s directory belongs to a discovered Nx project',
    (parent) => {
      const roots = readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${parent}/${entry.name}`);
      expect(roots.length).toBeGreaterThan(0);
      for (const root of roots) {
        expect(
          projects.filter((project) => project.data.root === root),
        ).toHaveLength(1);
      }
    },
  );

  test.each(projects)(
    '$name has an enforced ownership scope and platform',
    (project) => {
      const tags = project.data.tags ?? [];
      const scopes = tags.filter((tag) => tag.startsWith('scope:'));
      expect(scopes).toEqual([`scope:${project.name}`]);
      const scope = scopes[0]?.slice('scope:'.length);
      expect(scope).toBeDefined();
      expect(platforms).toHaveProperty(scope ?? '');
      const platform = Object.entries(platforms).find(
        ([name]) => name === scope,
      )?.[1];
      expect(tags.filter((tag) => tag.startsWith('platform:'))).toEqual([
        `platform:${platform}`,
      ]);
      expect(project.data.targets).toHaveProperty('build');
      expect(project.data.targets).toHaveProperty('typecheck');
    },
  );
});
