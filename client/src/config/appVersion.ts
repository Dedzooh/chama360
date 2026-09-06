export const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION?.trim() || (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__.trim() : '') || '0.0.0');
