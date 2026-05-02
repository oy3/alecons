module.exports = {
    apps: [
        {
            name: process.env.PM2_APP_NAME || 'alecons-api',
            script: 'dist/main.js',
            cwd: process.env.ALECONS_API_CWD || '/home/api/current',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '1G',
            error_file: '/var/log/pm2/alecons-api-error.log',
            out_file: '/var/log/pm2/alecons-api-out.log',
            time: true,
            env: {
                NODE_ENV: 'production',
                PORT: process.env.PORT || 8000,
                PUPPETEER_EXECUTABLE_PATH:
                    process.env.PUPPETEER_EXECUTABLE_PATH || '/opt/google/chrome/google-chrome',
                CHROME_PATH: process.env.CHROME_PATH,
            },
        },
    ],
};
