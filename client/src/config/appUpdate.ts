import { APP_VERSION } from './appVersion';
import { getApiBaseUrl, isLocalTestingHost } from './apiBase';

export interface AppReleaseInfo {
  androidLatestVersion?: string;
  androidMinSupportedVersion?: string;
  androidUpdateUrl?: string;
  androidForceUpdate?: boolean;
  androidApkSha256?: string;
  androidApkSizeBytes?: number;
  androidReleasedAt?: string;
  androidReleaseNotes?: string;
}

export interface AppUpdateState {
  currentVersion: string;
  latestVersion?: string;
  minimumVersion?: string;
  updateUrl?: string;
  forceUpdate: boolean;
  apkSha256?: string;
  apkSizeBytes?: number;
  releasedAt?: string;
  releaseNotes?: string;
}

const stripApiSuffix = (url: string) => url.replace(/\/api\/v1\/?$/, '');

export const getHealthUrl = () => {
  const base = getApiBaseUrl();
  return `${stripApiSuffix(base)}/health`;
};

const splitVersion = (value: string) => value.split('.').map((part) => Number.parseInt(part.replace(/[^0-9]/g, ''), 10) || 0);

export const compareVersions = (left: string, right: string) => {
  const leftParts = splitVersion(left);
  const rightParts = splitVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

export const shouldForceUpdate = (state: AppUpdateState) => {
  if (!state.latestVersion && !state.minimumVersion) return false;
  if (state.minimumVersion && compareVersions(state.currentVersion, state.minimumVersion) < 0) return true;
  if (state.forceUpdate && state.latestVersion && compareVersions(state.currentVersion, state.latestVersion) < 0) return true;
  return false;
};

export const isUpdateAvailable = (state: AppUpdateState) => {
  if (!state.latestVersion) return false;
  return compareVersions(state.currentVersion, state.latestVersion) < 0;
};

const normalizeUpdateUrl = (value?: string) => {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    const localHttp = import.meta.env.DEV && parsed.protocol === 'http:' && isLocalTestingHost(parsed.hostname);
    return parsed.protocol === 'https:' || localHttp ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
};

export const normalizeReleaseInfo = (release?: AppReleaseInfo | null): AppUpdateState => ({
  currentVersion: APP_VERSION,
  latestVersion: release?.androidLatestVersion || undefined,
  minimumVersion: release?.androidMinSupportedVersion || undefined,
  updateUrl: normalizeUpdateUrl(release?.androidUpdateUrl),
  forceUpdate: Boolean(release?.androidForceUpdate),
  apkSha256: release?.androidApkSha256?.toLowerCase() || undefined,
  apkSizeBytes: release?.androidApkSizeBytes,
  releasedAt: release?.androidReleasedAt,
  releaseNotes: release?.androidReleaseNotes,
});
