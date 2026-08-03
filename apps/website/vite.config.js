import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
