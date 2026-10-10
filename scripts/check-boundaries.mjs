import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBuiltin } from 'node:module';
import ts from 'typescript';

const allowed = {
  web: ['ui', 'contracts'],
  ui: [],
  contracts: [],
  database: [],
  runtime: ['database', 'contracts'],
  api: ['runtime', 'contracts'],
  worker: ['runtime', 'contracts'],
};
const browser = new Set(['web', 'ui', 'contracts']);
export function checkBoundaries(root = process.cwd()) {
  const errors = [];
  const graph = new Map();
  const files = [];
  function walk(folder) {
    if (!fs.existsSync(folder)) return;
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name);
      if (item.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(file)) files.push(file);
    }
  }
  for (const project of Object.keys(allowed))
    walk(
      path.join(
        root,
        ['web', 'api', 'worker'].includes(project) ? 'apps' : 'packages',
        project,
        'src',
      ),
    );
  const fileSet = new Set(files);
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const project = relative.split('/')[1];
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const edges = [];
    function visit(node) {
      let specifier;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        specifier = node.moduleSpecifier.text;
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require'))
      ) {
        if (
          node.arguments.length !== 1 ||
          !ts.isStringLiteral(node.arguments[0])
        )
          errors.push(`${relative}: dynamic module paths are forbidden`);
        else specifier = node.arguments[0].text;
      }
      if (specifier) {
        if (specifier.startsWith('@sprout/')) {
          const dependency = specifier.slice(8);
          if (!allowed[project].includes(dependency))
            errors.push(`${relative}: forbidden dependency ${specifier}`);
          const folder = ['web', 'api', 'worker'].includes(dependency)
            ? 'apps'
            : 'packages';
          edges.push(path.join(root, folder, dependency, 'src', 'index.ts'));
        } else if (specifier.startsWith('.')) {
          const target = path.resolve(path.dirname(file), specifier);
          const resolved = [
            target,
            target.replace(/\.js$/, '.ts'),
            target.replace(/\.js$/, '.tsx'),
            `${target}.ts`,
            `${target}.tsx`,
            path.join(target, 'index.ts'),
          ].find((candidate) => fileSet.has(candidate));
          if (resolved) {
            if (
              path
                .relative(root, resolved)
                .replaceAll('\\', '/')
                .split('/')[1] !== project
            )
              errors.push(
                `${relative}: cross-project imports must use public package exports`,
              );
            edges.push(resolved);
          }
        } else if (
          browser.has(project) &&
          (isBuiltin(specifier) ||
            /^(pg$|drizzle-orm|@effect\/platform-node|pg-boss)/.test(specifier))
        )
          errors.push(`${relative}: server dependency in browser`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    graph.set(file, edges);
  }
  const active = new Set();
  const done = new Set();
  function cycle(file) {
    if (active.has(file)) {
      errors.push(`Import cycle involving ${path.relative(root, file)}`);
      return;
    }
    if (done.has(file)) return;
    active.add(file);
    for (const edge of graph.get(file) ?? []) cycle(edge);
    active.delete(file);
    done.add(file);
  }
  for (const file of files) cycle(file);
  return errors;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = checkBoundaries();
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log('Workspace import boundaries and cycles checked.');
}
