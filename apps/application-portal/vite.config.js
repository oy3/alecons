import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared'),
      'bootstrap': path.resolve(__dirname, '../../node_modules/bootstrap'),
      '@bootstrap-icons': path.resolve(__dirname, '../../node_modules/bootstrap-icons'),
      '@popperjs/core': path.resolve(__dirname, '../../node_modules/@popperjs/core')
    }
  },
  optimizeDeps: {
    include: ['bootstrap', '@popperjs/core']
  }
});
