import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viteEntry = join(clientRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const productionApiUrl = 'https://chamaz360.co.ke/api/v1';
const productionWebUrl = 'https://chamaz360.co.ke';

const result = spawnSync(process.execPath, [viteEntry, 'build', '--mode', 'android'], {
  cwd: clientRoot,
  env: {
    ...process.env,
    VITE_API_URL: productionApiUrl,
    VITE_ANDROID_API_URL: productionApiUrl,
    VITE_PUBLIC_WEB_URL: productionWebUrl,
  },
  stdio: 'inherit',
});

if (result.status !== 0) process.exit(result.status ?? 1);

// Public APK downloads belong to the website distribution surface. Exclude
// them from the native bundle so release APKs are never recursively packaged.
rmSync(join(clientRoot, 'dist', 'downloads'), { recursive: true, force: true });
