import { bootstrapOwner } from './auth.js';
import { loadSettings } from './config.js';

bootstrapOwner(loadSettings('api').database)
  .then(() => {
    console.info('Owner provisioned; public signup remains disabled');
  })
  .catch(() => {
    console.error(
      'Owner bootstrap failed; check environment, migrations and whether an owner already exists',
    );
    process.exitCode = 1;
  });
