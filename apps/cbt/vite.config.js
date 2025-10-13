import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, '../../packages/shared')
      }
    },
    server: {
      port: 3004,
      host: true
    },
    envDir: './',
    envPrefix: 'VITE_'
  }
})