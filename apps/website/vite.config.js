import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.js'],
    restoreMocks: true
  }
})
