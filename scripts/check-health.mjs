const targets = [
  ['api', process.env.API_URL ?? 'http://127.0.0.1:3001'],
  ['worker', process.env.WORKER_URL ?? 'http://127.0.0.1:3002'],
];
for (const [component, base] of targets) {
  for (const kind of ['live', 'ready']) {
    const response = await fetch(`${base}/health/${kind}`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    if (
      response.status !== 200 ||
      body.component !== component ||
      body.status !== kind
    )
      throw new Error(`${component} ${kind} health check failed`);
    if (
      kind === 'ready' &&
      ['postgres', 'migrations', 'pgvector'].some(
        (dependency) => body.dependencies?.[dependency] !== 'ready',
      )
    )
      throw new Error(`${component} dependencies are not ready`);
  }
  console.log(
    `${component}: live; PostgreSQL, committed migrations and pgvector ready.`,
  );
}
