import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      // Permit the Manus Preview forwarding hostname without disabling DNS-rebinding protection.
      allowedHosts: ['.sg2.manus.computer'],
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          configure: (proxy) => {
            // The browser talks to Vite on the same origin; CORS is not needed for this server-side hop.
            proxy.on('proxyReq', (proxyRequest) => proxyRequest.removeHeader('origin'));
          },
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: ['.sg2.manus.computer'],
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      restoreMocks: true,
      clearMocks: true,
    },
  };
});
