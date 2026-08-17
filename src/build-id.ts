/**
 * Identifier for the deployed bundle, replaced at build time by Vite. The browser-local
 * play record is keyed on it, so a new build starts the record from zero.
 */
declare const __DEFUSE_BUILD_ID__: string | undefined;

export const BUILD_ID: string = typeof __DEFUSE_BUILD_ID__ === 'string' ? __DEFUSE_BUILD_ID__ : 'development';
