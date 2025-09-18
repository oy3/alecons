/**
 * Logger utility for consistent logging across frontend and backend
 */

// Log levels with their corresponding numerical values
export const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// ANSI color codes for terminal output
const Colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    green: '\x1b[32m'
};

class Logger {
    constructor(options = {}) {
        this.level = this.getLogLevelFromEnv();
        this.options = {
            timestamp: true,
            color: true,
            ...options
        };
    }

    getLogLevelFromEnv() {
        // For frontend (Vite)
        const env = import.meta?.env?.VITE_APP_ENV ||
            // For backend (Node.js)
            process?.env?.NODE_ENV ||
            'development';

        const debugMode = import.meta?.env?.VITE_APP_DEBUG === 'true' ||
            process?.env?.DEBUG === 'true' ||
            false;

        if (env === 'production') {
            return debugMode ? LogLevel.INFO : LogLevel.ERROR;
        }
        return debugMode ? LogLevel.DEBUG : LogLevel.INFO;
    }

    getTime() {
        return new Date().toISOString();
    }

    formatMessage(level, message, ...args) {
        const parts = [];

        if (this.options.timestamp) {
            parts.push(`[${this.getTime()}]`);
        }

        if (this.options.prefix) {
            parts.push(`[${this.options.prefix}]`);
        }

        parts.push(`[${level}]`);

        const finalMessage = typeof message === 'string'
            ? message
            : JSON.stringify(message, null, 2);
        parts.push(finalMessage);

        if (args.length > 0) {
            parts.push(args.map(arg =>
                typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
            ).join(' '));
        }

        return parts.join(' ');
    }

    shouldLog(level) {
        return LogLevel[level] <= this.level;
    }

    colorize(message, color) {
        return this.options.color ? `${Colors[color]}${message}${Colors.reset}` : message;
    }

    error(message, ...args) {
        if (this.shouldLog('ERROR')) {
            const formattedMessage = this.formatMessage('ERROR', message, ...args);
            console.error(this.colorize(formattedMessage, 'red'));
        }
    }

    warn(message, ...args) {
        if (this.shouldLog('WARN')) {
            const formattedMessage = this.formatMessage('WARN', message, ...args);
            console.warn(this.colorize(formattedMessage, 'yellow'));
        }
    }

    info(message, ...args) {
        if (this.shouldLog('INFO')) {
            const formattedMessage = this.formatMessage('INFO', message, ...args);
            console.info(this.colorize(formattedMessage, 'blue'));
        }
    }

    debug(message, ...args) {
        if (this.shouldLog('DEBUG')) {
            const formattedMessage = this.formatMessage('DEBUG', message, ...args);
            console.debug(this.colorize(formattedMessage, 'gray'));
        }
    }

    success(message, ...args) {
        if (this.shouldLog('INFO')) {
            const formattedMessage = this.formatMessage('SUCCESS', message, ...args);
            console.log(this.colorize(formattedMessage, 'green'));
        }
    }
}

// Create default logger instance
export const logger = new Logger();

// Export factory function for creating custom loggers
export const createLogger = (options) => new Logger(options);
