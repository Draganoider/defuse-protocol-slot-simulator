import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project from a repository subpath, so built asset URLs need
// that prefix. Preview uses it too so a local preview matches the published site. The
// development server keeps the root path so local URLs stay simple.
const GITHUB_PAGES_BASE = '/defuse-protocol-slot-simulator/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? GITHUB_PAGES_BASE : '/',
  plugins: [react()],
}));
