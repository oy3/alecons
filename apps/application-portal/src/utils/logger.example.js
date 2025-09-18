import { logger, createLogger } from '@shared/utils/logger';

// Using the default logger
logger.info('Application started');
logger.debug('Debug information:', { userId: 123, action: 'login' });
logger.warn('Deprecated feature used');
logger.error('Error occurred', new Error('Something went wrong'));
logger.success('Operation completed successfully');

// Creating a custom logger with specific options
const apiLogger = createLogger({
    prefix: 'API',
    timestamp: true,
    color: true
});

// Example usage in a Vue component
export default {
    name: 'ExampleComponent',
    methods: {
        handleUserLogin() {
            logger.info('User attempting to login');
            try {
                // login logic here
                logger.success('User logged in successfully');
            } catch (error) {
                logger.error('Login failed:', error);
            }
        },

        fetchData() {
            apiLogger.info('Fetching data from API');
            // API call logic here
        }
    }
};
