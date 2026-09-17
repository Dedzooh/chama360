import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetScript = join(root, 'scripts', 'generate-mobile-assets.py');
const isWindows = process.platform === 'win32';

const splitLines = (value) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const where = (command) => {
  if (!isWindows) {
    return [command];
  }

  const result = spawnSync('where.exe', [command], { encoding: 'utf8' });
  return result.status === 0 ? splitLines(result.stdout) : [];
};

const localPython =
  isWindows && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'Python', 'bin', 'python.exe')
    : undefined;

const candidates = [
  process.env.PYTHON,
  localPython,
  ...where('python3'),
  ...where('python'),
].filter(Boolean);

const uniqueCandidates = [...new Set(candidates)].filter((candidate) => {
  if (isWindows && candidate.toLowerCase().includes('\\microsoft\\windowsapps\\')) {
    return false;
  }

  return !candidate.includes('\\') && !candidate.includes('/') ? true : existsSync(candidate);
});

const findPython = () => {
  const checked = [];

  for (const candidate of uniqueCandidates) {
    const version = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (version.status !== 0) {
      checked.push(`${candidate}: not executable`);
      continue;
    }

    const pillow = spawnSync(candidate, ['-c', 'from PIL import Image'], { encoding: 'utf8' });
    if (pillow.status !== 0) {
      checked.push(`${candidate}: Pillow is not installed`);
      continue;
    }

    return candidate;
  }

  const message = checked.length ? `\nChecked:\n  ${checked.join('\n  ')}` : '';
  throw new Error(
    `No usable Python with Pillow was found.${message}\nInstall Pillow with your Python executable, for example:\n  python -m pip install Pillow`,
  );
};

const python = findPython();
const result = spawnSync(python, [assetScript], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
