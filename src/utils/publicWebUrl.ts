import { config } from '../config/environment';

export const createPublicHashUrl = (path: string) => {
  const origin = config.server.webUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}/#${normalizedPath}`;
};
