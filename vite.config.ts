import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project from a repository subpath, so built asset URLs need
// that prefix. Preview uses it too so a local preview matches the published site. The
// development server keeps the root path so local URLs stay simple.
const GITHUB_PAGES_BASE = '/defuse-protocol-slot-simulator/';

// Stamped into the bundle so the browser-local play record starts fresh on a new build
// instead of mixing figures across game versions.
const BUILD_ID = new Date().toISOString();

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? GITHUB_PAGES_BASE : '/',
  define: { __DEFUSE_BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react()],
}));
