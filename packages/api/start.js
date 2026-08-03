// Load environment variables first
require('dotenv').config({ path: '.env.production' });

// Log environment variables to verify they're loaded
console.log('=== Environment Variables Loaded ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Loaded successfully' : 'NOT LOADED');
console.log('PORT:', process.env.PORT);
console.log('===================================');

// Start the main application
require('./dist/main.js');
