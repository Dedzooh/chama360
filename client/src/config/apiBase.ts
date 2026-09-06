import { Capacitor } from '@capacitor/core';

const FALLBACK_WEB_API_URL = 'http://localhost:3000/api/v1';
const FALLBACK_ANDROID_API_URL = 'http://10.0.2.2:3000/api/v1';
const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

const adaptLoopbackUrlForLanBrowser = (configuredUrl: string) => {
  if (typeof window === 'undefined') return configuredUrl;

  try {
    const url = new URL(configuredUrl);
    if (loopbackHosts.has(url.hostname) && !loopbackHosts.has(window.location.hostname)) {
      url.hostname = window.location.hostname;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    // Environment validation and the request layer will surface invalid URLs.
  }

  return configuredUrl;
};

export const getApiBaseUrl = () => {
  const webUrl = import.meta.env.VITE_API_URL?.trim() || FALLBACK_WEB_API_URL;
  if (!Capacitor.isNativePlatform()) return adaptLoopbackUrlForLanBrowser(webUrl);
  return import.meta.env.VITE_ANDROID_API_URL?.trim() || webUrl || FALLBACK_ANDROID_API_URL;
};

export const isLocalTestingHost = (hostname: string) =>
  loopbackHosts.has(hostname) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
