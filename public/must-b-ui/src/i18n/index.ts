// Vite resolves .ts before .tsx for directory imports.
// This shim re-exports everything from the JSX provider without
// containing any JSX itself (esbuild can't process JSX in .ts files).
export { I18nProvider, useI18n } from './provider';
export type { Locale } from './provider';
