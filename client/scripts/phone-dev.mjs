import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const command = process.argv[2] ?? 'help';
const explicitUrl = process.env.CHAMA_DEV_SERVER_URL || process.argv.find((arg) => arg.startsWith('--url='))?.slice(6);
const isWindows = process.platform === 'win32';
const repoRoot = process.cwd();
const androidStudioJbr = isWindows ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : '';
const javaHome = process.env.JAVA_HOME || (androidStudioJbr && existsSync(join(androidStudioJbr, 'bin', 'java.exe')) ? androidStudioJbr : undefined);
const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : undefined);

const pickLanIp = () => {
  const interfaces = os.networkInterfaces();
  const preferred = [];
  const fallback = [];

  for (const [name, addresses = []] of Object.entries(interfaces)) {
    const lowerName = name.toLowerCase();
    const virtual = /virtual|vmware|vbox|docker|loopback|wsl|hyper-v|bluetooth/.test(lowerName);

    for (const address of addresses) {
      if (address.family !== 'IPv4' || address.internal || address.address.startsWith('169.254.')) {
        continue;
      }

      const item = { name, address: address.address };
      if (!virtual && /wi-?fi|wireless|wlan|ethernet|local area/.test(lowerName)) {
        preferred.push(item);
      } else if (!virtual) {
        fallback.push(item);
      }
    }
  }

  return preferred[0] ?? fallback[0] ?? null;
};

const lan = pickLanIp();
const devServerUrl = explicitUrl ?? (lan ? `http://${lan.address}:5173` : '');

const run = (file, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...process.env,
        CHAMA_DEV_SERVER_URL: devServerUrl,
        ...(javaHome
          ? {
              JAVA_HOME: javaHome,
              Path: `${join(javaHome, 'bin')};${process.env.Path ?? process.env.PATH ?? ''}`,
            }
          : {}),
        ...(androidSdk && existsSync(androidSdk)
          ? {
              ANDROID_HOME: androidSdk,
              ANDROID_SDK_ROOT: androidSdk,
            }
          : {}),
        ...options.env,
      },
      shell: isWindows && /\.(cmd|bat)$/i.test(file),
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${file} ${args.join(' ')} exited with ${code}`));
      }
    });
  });

const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const gradleCmd = isWindows ? 'gradlew.bat' : './gradlew';
const adbFromSdk = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', isWindows ? 'adb.exe' : 'adb')
  : '';
const adbCmd = existsSync(adbFromSdk) ? adbFromSdk : 'adb';

const printInfo = () => {
  if (!devServerUrl) {
    throw new Error('No LAN IPv4 address found. Set CHAMA_DEV_SERVER_URL manually, for example http://192.168.1.20:5173');
  }

  console.log(`CHAMAZ360 phone dev URL: ${devServerUrl}`);
  if (lan) {
    console.log(`Selected network adapter: ${lan.name}`);
  }
};

const syncAndroid = async () => {
  printInfo();
  await run(npmCmd, ['run', 'build:android']);
  await run(npxCmd, ['cap', 'sync', 'android']);
};

const installAndroid = async () => {
  await syncAndroid();
  await run(gradleCmd, ['installDebug'], { cwd: join(repoRoot, 'android') });
};

try {
  if (command === 'url') {
    printInfo();
  } else if (command === 'devices') {
    await run(adbCmd, ['devices', '-l']);
  } else if (command === 'sync') {
    await syncAndroid();
  } else if (command === 'install') {
    await installAndroid();
  } else {
    console.log(`Usage:
  npm run phone:url
  npm run phone:devices
  npm run phone:sync
  npm run phone:install

Start the LAN dev server separately with:
  npm run dev:phone

Override the detected URL when needed:
  $env:CHAMA_DEV_SERVER_URL="http://192.168.1.20:5173"; npm run phone:install`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
