import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { parseEnv } from 'node:util';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const envFile = resolve('.env.server');
  const serverEnv =
    command === 'serve' && existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
  const managementKey = process.env.CUBE_MANAGEMENT_KEY ?? serverEnv.CUBE_MANAGEMENT_KEY;
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/cube-management': {
          target: 'http://127.0.0.1:3002',
          configure: (proxy) => {
            proxy.on('proxyReq', (request) => {
              request.removeHeader('X-Management-Key');
              if (managementKey) request.setHeader('X-Management-Key', managementKey);
            });
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@ui': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@uiShare': fileURLToPath(new URL('./src/ui/components', import.meta.url)),
      },
    },
  };
});
