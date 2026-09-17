import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const apkArgument = process.argv[2];
if (!apkArgument) {
  console.error('Usage: node scripts/android-release-metadata.mjs <signed-apk-path>');
  process.exitCode = 1;
} else {
  const apkPath = resolve(apkArgument);
  const contents = readFileSync(apkPath);
  const sha256 = createHash('sha256').update(contents).digest('hex');
  const size = statSync(apkPath).size;
  console.log(`ANDROID_APK_SHA256="${sha256}"`);
  console.log(`ANDROID_APK_SIZE_BYTES=${size}`);
  console.log(`ANDROID_RELEASED_AT="${new Date().toISOString()}"`);
}
