import { Capacitor } from '@capacitor/core';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

export const getPublicWebOrigin = () => {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_WEB_URL?.trim().replace(/\/$/, '');

  if (configuredOrigin) {
    const url = new URL(configuredOrigin);
    if (Capacitor.isNativePlatform() && import.meta.env.PROD && (url.protocol !== 'https:' || loopbackHosts.has(url.hostname))) {
      throw new Error('VITE_PUBLIC_WEB_URL must be a non-loopback HTTPS URL in production native builds');
    }
    return url.origin;
  }

  if (Capacitor.isNativePlatform() && import.meta.env.PROD) {
    throw new Error('VITE_PUBLIC_WEB_URL is required in production native builds');
  }

  return window.location.origin;
};

export const createPublicHashUrl = (path: string) =>
  `${getPublicWebOrigin()}/#${path.startsWith('/') ? path : `/${path}`}`;
