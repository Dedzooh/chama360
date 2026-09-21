import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viteEntry = join(clientRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const productionApiUrl = 'https://chamaz360.co.ke/api/v1';

const result = spawnSync(process.execPath, [viteEntry, 'build', '--mode', 'android'], {
  cwd: clientRoot,
  env: {
    ...process.env,
    VITE_API_URL: productionApiUrl,
    VITE_ANDROID_API_URL: productionApiUrl,
  },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
