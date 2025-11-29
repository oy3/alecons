import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from "path";

export default defineConfig({
    plugins: [vue()],
    server: {
        port: 3002,
        host: true
    },
    preview: {
        port: 3002,
        host: true
    },
    define: {
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
    },
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
})