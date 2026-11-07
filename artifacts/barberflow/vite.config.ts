import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

// Variáveis ficam no .env da raiz do monorepo (veja .env.example).
const envDir = path.resolve(import.meta.dirname, '..', '..');

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };

  const port = Number(env.WEB_PORT ?? 5173);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid WEB_PORT value: "${env.WEB_PORT}"`);
  }

  // Em dev, o Vite repassa /api para o servidor Express.
  const apiTarget = env.API_PROXY_TARGET ?? `http://localhost:${env.PORT ?? 8080}`;

  return {
    base: env.BASE_PATH ?? '/',
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      fs: { strict: true },
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      port,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
