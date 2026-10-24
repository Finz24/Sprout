import { backupWorkspace } from './restore-workspace.mjs';

await backupWorkspace(process.argv.slice(2));
