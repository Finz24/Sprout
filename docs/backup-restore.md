# Back up and restore a workspace

The [issue #31](https://github.com/Finz24/Sprout/issues/31) tools copy a Compose
workspace's PostgreSQL database and private originals together. They use a
PostgreSQL custom-format dump, raw files, and a version 1 JSON manifest.
There is no default backup location, automatic retention, or data deletion.

## Prepare the workspace

Follow [development setup and worktree isolation](development.md) first. Use the
same `COMPOSE_PROJECT_NAME` and port variables in this terminal. PostgreSQL must
be running, and the project's existing `api` or `worker` containers must expose
the same originals mount at `/workspace/originals`.

The scripts use Node's standard library and Docker CLI commands. PostgreSQL tools
run inside the existing PostgreSQL container. Prepare the pinned Node version,
Docker, and PostgreSQL image before going offline. Runtime commands do not
download dependencies. The backup helper uses the existing image with
`--pull never`. See [prepared offline use](development.md#prepared-offline-use)
for image and dependency transfer.

Stop external writers, local API and worker processes, Compose Watch, and
migrations before backup. Keep them stopped until backup finishes. The tool
stops only this Compose project's running `api` and `worker` containers. It does
not stop other clients or prevent them from writing.

Treat the whole backup as credential-sensitive private data. It can include
password hashes, sessions, every private record, and original files. Keep backup
content out of Git, public logs, and test artifacts. File creation modes do not
set a Windows ACL policy. SHA-256 checks detect changes against the manifest;
they do not authenticate its author or protect against coordinated tampering.

## Create a backup

Choose a destination whose parent exists. The destination itself must not exist
and must not overlap the originals source. Run commands from the repository root.
These Windows paths are examples, not a location or retention policy.

```powershell
node scripts/backup-workspace.mjs --dest 'C:\Sprout backups\2026-10-24-a'
```

`--dest` is required and is the only backup option. The tool creates a temporary
sibling named `.2026-10-24-a.partial-<suffix>`, stops the recorded running
containers, checks migration history, inventories the database, dumps it, and
copies originals. It compares the database inventory again and verifies the
backup before renaming the temporary folder to the destination.

The tool never replaces an existing destination or deletes a previous backup.
Failed temporary folders remain for inspection. In `finally`, it attempts to
restart the exact container IDs recorded as running. Containers that were
already stopped stay stopped. A restart failure can occur after publication, so
inspect both the destination and container status after any failure.

A stopped helper container named `<PROJECT>-backup-lock` holds a daemon-wide
exclusive lease for that project and normally mounts originals read-only. Its
`sprout.backup.running` label records the initially running container IDs,
separated by commas. The helper never runs. A restart failure retains the lease.

### Connection and originals overrides

`SPROUT_BACKUP_DATABASE_URL` overrides the resolved Compose API `DATABASE_URL`.
The ordinary host `DATABASE_URL` variable is not this override. Provide secrets
through the process environment without committing or printing them.

The URL accepts `postgres:` or `postgresql:`, a nonempty user and database, and
no query options or fragment. Accepted endpoints are:

- `postgres:5432` or the selected PostgreSQL container's name on port 5432.
- `localhost`, `127.0.0.1`, or `[::1]` with a host port published by that container
  for `5432/tcp`.

An omitted port means 5432. All accepted endpoints translate to container
loopback `127.0.0.1:5432`; credentials and the database name come from the URL.
Remote databases and arbitrary endpoints are rejected.

`SPROUT_BACKUP_ORIGINALS_DIR` selects a synthetic host originals folder for
fixtures instead of copying the Compose mount. It does not remove the workspace
container and mount prerequisites. Leave it unset for the real volume backup.

## Verify or restore a trusted backup

Verify manifest structure, paths, sizes, and file hashes without Docker or any
restore target:

```powershell
node scripts/restore-workspace.mjs --from 'C:\Sprout backups\2026-10-24-a' --verify-only
```

This does not restore the dump or prove that its SQL can execute. Restore only a
trusted backup. `pg_restore` executes SQL from the dump with the selected role's
privileges, even when all hashes match.

For a restore, select a new database name and an empty or nonexistent local
folder. Restore never targets the live workspace. Run with the prepared Compose
workspace available as described above.

```powershell
node scripts/restore-workspace.mjs --from 'C:\Sprout backups\2026-10-24-a' --database sprout_restore_20261024 --originals 'C:\Sprout restore\2026-10-24-a\originals'
```

The database name must start with a lowercase letter, contain only lowercase
letters, digits, and underscores, and fit in 63 bytes. Existing databases,
`sprout`, `postgres`, `template0`, `template1`, the connected source database,
and the manifest's source database are forbidden.

The originals target cannot overlap the backup, known live originals paths,
the repository's `originals` folder, or `/workspace/originals`. The live volume
name is also forbidden. Symlink paths and nonempty targets are rejected.

The tool verifies backup hashes and checks that manifest migrations exactly
match this checkout before creating either target. It creates the database from
`template0`, restores in one transaction, copies originals, then compares file
hashes, migration history, and the complete recorded database inventory.
Object ownership and ACLs are preserved by the dump and restore options. Required
cluster roles must already exist; the backup does not export cluster roles.

On failure, the tool retains the new database and any copied files. It never
drops, cleans, or overwrites a target. Inspect the failure and use different new
targets for another attempt. A successful restore does not switch the app to
the restored database or folder.

## Recover after an interrupted backup

Catchable interruption and ordinary errors pass through the restart cleanup.
A process crash, forced kill, or host failure can leave containers stopped and
a stale lease. Signal handling and restart attempts are not a guarantee against
those failures. Do not remove a lease while its backup process is still active.

1. Confirm the selected Compose project and that its backup process has ended.
   Keep external writers, Compose Watch, and migrations stopped.
2. Inspect only that project's lease and its recorded IDs. For example:

   ```powershell
   $lease = "$($env:COMPOSE_PROJECT_NAME)-backup-lock"
   docker inspect --format '{{json .Config.Labels}}' $lease
   docker inspect --format '{{index .Config.Labels "sprout.backup.running"}}' $lease
   ```

3. Inspect each recorded ID. Confirm its Compose project and service labels
   belong to this workspace's `api` or `worker`. Restart only those recorded IDs
   that need restarting. Never substitute all services or another project's IDs.

   ```powershell
   docker inspect --format '{{json .Config.Labels}} {{json .State}}' <recorded-container-id>
   docker start <recorded-container-id>
   ```

4. Verify every recorded container's status and application readiness before
   removing the lease. If an ID is missing or restart fails, leave the lease and
   resolve that failure first. An empty recorded list requires no restart.

   ```powershell
   docker compose ps --all api worker
   docker inspect --format '{{json .State}}' <recorded-container-id>
   ```

5. After verification, remove only the inspected stopped helper container:

   ```powershell
   docker rm $lease
   ```

Inspect any retained partial directory and verify any published backup
separately. Recovery does not require deleting volumes or restore targets.

## Manifest version 1 reference

The backup root contains exactly `manifest.json`, `database.dump`, and
`originals/`. The following table lists the parsed fields. SHA-256 values are
64 lowercase hexadecimal characters. Sizes are nonnegative safe integers.

| Field                 | Version 1 value                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `formatVersion`       | Number `1`. Other numeric versions are unsupported.                                                                   |
| `createdAt`           | Valid ISO timestamp with a timezone.                                                                                  |
| `source`              | `{ project, database, runningServices }`. Names are nonempty strings; services are `api` or `worker`.                 |
| `dump`                | `{ size, sha256 }` for `database.dump`.                                                                               |
| `originals`           | Array of `{ path, size, sha256 }` for every original file.                                                            |
| `directories`         | Array of relative directory paths, including empty directories and every parent.                                      |
| `migrations`          | Ordered array of `{ tag, when, sha256 }` from the repository migration journal and SQL files. `when` is numeric.      |
| `inventory.objects`   | Array containing `{ name: "database-schema", definition }`, where `definition` is the complete normalized schema SQL. |
| `inventory.tables`    | Array of `{ schema, name, rows, sha256 }`. `rows` is a decimal string.                                                |
| `inventory.sequences` | Array of `{ schema, name, lastValue, isCalled }`. The value is a string; `isCalled` is boolean.                       |

Original paths use relative forward slashes. Absolute paths, backslashes,
colons, control characters, empty segments, `.` and `..` are rejected.
Case-insensitive duplicate paths, symlinks, unsupported entries, missing files,
and undeclared files or directories fail verification.

Schema normalization removes only generated dump envelope tokens and version
lines. SQL bodies and object comments remain exact. Table inventories cover
user tables and materialized views. Each column is cast to text, assembled into
a JSON row, sorted with the `C` collation, and streamed through text `COPY`.
The inventory records that stream's SHA-256 and row count. Sequence inventories
record `last_value` and `is_called`. Migration verification compares the exact
ordered database history against repository SQL hashes and journal timestamps.

Foreign servers, foreign tables, subscriptions, large objects, and nondefault
database or relation tablespaces are rejected as `unsupported-external-data`.

## CLI results and proof limits

Each command writes one JSON result. Successful statuses are `backed-up`,
`verified`, and `restored`, with `files` counting original files plus the dump.
Failure exits nonzero and reports `{"status":"failed","reason":"..."}` with
an optional named `path`. Examples include `invalid-database-endpoint`,
`target-exists`, `sha256-mismatch`, `migration-history-mismatch`,
`incomplete-restore`, and `service-restart-failed`. Child diagnostics are
suppressed so command failures do not print connection URLs, passwords, SQL
bodies, or private rows. Paths and object names can still be sensitive.

These checks establish file integrity and database inventory agreement. They do
not prove authentication, user ownership, full RLS behavior, application-level
quiescence, or pg-boss reconciliation. Full application restore proof belongs to
[issue #39](https://github.com/Finz24/Sprout/issues/39), including recovery without
duplicate enrichment or commands. Real volume copying and signal or restart
failure injection still require runtime verification; passing unit and
integration checks alone does not establish those behaviors.

## Decisions reserved for Ohad

The implementation leaves these four decisions open:

- Backup location and retention, including off-machine copies and expiry.
- Encryption and access policy for backup files.
- The production database role allowed to read every owner's rows, including
  the privileged access needed to bypass RLS.
- Whether restore over a live workspace is ever allowed. It is currently forbidden.
