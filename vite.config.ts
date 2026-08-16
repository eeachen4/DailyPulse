import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 让打包后的资源使用相对路径，便于直接部署到 GitHub Pages 的任意子路径。
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
