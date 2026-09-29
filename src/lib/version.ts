/** App version (package.json) and the short commit id of this build, both injected by vite.config.ts. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';

/** e.g. "1.1.0 · a2b5a46" */
export const versionLabel = (): string => `${APP_VERSION} · ${APP_BUILD}`;
