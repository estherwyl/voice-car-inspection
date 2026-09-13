import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, copyFile, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await build({ configFile: false, plugins: [react()], build: { outDir: 'dist/client' } });
await build({
  configFile: false,
  publicDir: false,
  build: { ssr: 'server/sites-worker.ts', outDir: 'dist/server', rollupOptions: { output: { entryFileNames: 'index.js' } } },
});
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
