declare module 'vite' {
    interface ImportMeta {
        readonly env: {
            readonly VITE_APP_ENV: string;
            readonly VITE_APP_DEBUG: string;
            readonly [key: string]: string;
        };
    }
}
