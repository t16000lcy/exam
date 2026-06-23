import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function copyDir(source: string, target: string) {
  if (!existsSync(source)) return;
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source)) {
    const from = path.join(source, entry);
    const to = path.join(target, entry);
    if (statSync(from).isDirectory()) {
      copyDir(from, to);
    } else {
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
    }
  }
}

function questionDataPlugin(): Plugin {
  const dataRoot = path.resolve(process.cwd(), 'data');
  return {
    name: 'question-data-static',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const relativePath = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
        const filePath = path.resolve(dataRoot, relativePath);
        if (!filePath.startsWith(dataRoot) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      copyDir(dataRoot, path.resolve(process.cwd(), 'dist', 'data'));
    },
  };
}

export default defineConfig({
  plugins: [react(), questionDataPlugin()],
  base: './',
});
