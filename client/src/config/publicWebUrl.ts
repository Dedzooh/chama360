import { Capacitor } from '@capacitor/core';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

export const getPublicWebOrigin = () => {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_WEB_URL?.trim().replace(/\/$/, '');

  if (configuredOrigin) {
    // Defensive: an invalid build-time URL must never crash the consuming
    // page (Members failed to construct 'URL' when a placeholder got baked
    // in). Fall back to the current origin instead of throwing.
    let parsed: URL;
    try {
      parsed = new URL(configuredOrigin);
    } catch {
      console.error('VITE_PUBLIC_WEB_URL is not a valid URL:', configuredOrigin);
      return window.location.origin;
    }
    if (Capacitor.isNativePlatform() && import.meta.env.PROD && (parsed.protocol !== 'https:' || loopbackHosts.has(parsed.hostname))) {
      throw new Error('VITE_PUBLIC_WEB_URL must be a non-loopback HTTPS URL in production native builds');
    }
    return parsed.origin;
  }

  if (Capacitor.isNativePlatform() && import.meta.env.PROD) {
    throw new Error('VITE_PUBLIC_WEB_URL is required in production native builds');
  }

  return window.location.origin;
};

export const createPublicHashUrl = (path: string) =>
  `${getPublicWebOrigin()}/#${path.startsWith('/') ? path : `/${path}`}`;
