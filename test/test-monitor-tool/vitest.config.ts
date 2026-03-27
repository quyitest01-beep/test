import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'src/server'),
      '@client': path.resolve(__dirname, 'src/client'),
    },
  },
});
