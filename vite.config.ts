import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

export default defineConfig({
  server: {
    watch: {
      // Ignore external project files to prevent hot-reload crashes on Windows
      ignored: ['!**/node_modules/**', '**/dist/**']
    }
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(options) {
          // Use spawn instead of startup to avoid process kill issues on Windows
          options.startup(['--no-sandbox']);
        },
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron', 'chokidar', 'node-pty']
            }
          },
          // Only watch src/main files, not external project files
          server: {
            watch: {
              ignored: ['**/node_modules/**', '**/dist/**', '!**/src/main/**']
            }
          }
        }
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist/preload'
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer')
    }
  },
  build: {
    outDir: 'dist/renderer'
  }
});
