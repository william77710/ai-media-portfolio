import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 使用相对路径 base: './'，确保在 GitHub Pages 二级子路径下资源加载 100% 正常
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
