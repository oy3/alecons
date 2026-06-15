const appRoot = process.env.ALECONS_APP_ROOT || '/home/rootlab/apps/alecons';

module.exports = {
    apps: [
        {
            name: process.env.PM2_APP_NAME || 'alecons-api',
            script: 'dist/main.js',
            cwd: process.env.ALECONS_API_CWD || `${appRoot}/api/current`,
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '1G',
            error_file: process.env.PM2_ERROR_FILE || `${appRoot}/logs/alecons-api-error.log`,
            out_file: process.env.PM2_OUT_FILE || `${appRoot}/logs/alecons-api-out.log`,
            time: true,
            env: {
                NODE_ENV: 'production',
                PORT: process.env.PORT || 8084,
                PUPPETEER_EXECUTABLE_PATH:
                    process.env.PUPPETEER_EXECUTABLE_PATH || '/opt/google/chrome/google-chrome',
                CHROME_PATH: process.env.CHROME_PATH,
            },
        },
    ],
};
