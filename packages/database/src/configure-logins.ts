import { Client } from 'pg';

const roles = [
  ['sprout_auth', 'AUTH_DATABASE_URL'],
  ['sprout_api', 'API_DATABASE_URL'],
  ['sprout_worker', 'WORKER_DATABASE_URL'],
  ['sprout_maintenance', 'MAINTENANCE_DATABASE_URL'],
] as const;

const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
try {
  const credentials = roles.map(([role, name]) => {
    const url = new URL(process.env[name] ?? '');
    if (url.username !== role || !url.password || !['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('Invalid credential');
    return { role, password: decodeURIComponent(url.password) };
  });
  await client.connect();
  await client.query('BEGIN');
  await client.query('SET LOCAL log_statement = none');
  await client.query('SET LOCAL log_min_error_statement = panic');
  await client.query('SET LOCAL log_parameter_max_length_on_error = 0');
  for (const { role, password } of credentials) {
    await client.query("SELECT set_config('sprout.provision_password', $1, true)", [password]);
    // Identifiers are fixed; PostgreSQL quotes the private value without returning it to the caller.
    await client.query(`DO $$ BEGIN EXECUTE format('ALTER ROLE ${role} LOGIN PASSWORD %L', current_setting('sprout.provision_password')); END $$`);
  }
  if (process.env.POSTGRES_PASSWORD) {
    await client.query("SELECT set_config('sprout.provision_password', $1, true)", [process.env.POSTGRES_PASSWORD]);
    await client.query("DO $$ BEGIN EXECUTE format('ALTER ROLE sprout PASSWORD %L', current_setting('sprout.provision_password')); END $$");
  }
  await client.query('COMMIT');
  console.info('Separate authenticated logins configured. Enable SCRAM authentication before serving.');
} catch {
  console.error('Login configuration failed. Use the offline migration identity and private environment credentials.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
