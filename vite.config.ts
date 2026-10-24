import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '127.0.0.1',
        strictPort: true,
      },
      preview: {
        host: '127.0.0.1',
      },
      build: {
        target: 'es2022',
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks(id: string) {
              if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
                return 'vendor';
              }
              if (id.includes('node_modules/gsap') || id.includes('node_modules/motion')) {
                return 'motion';
              }
            },
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(import.meta.dirname, '.'),
        },
      },
    };
});
