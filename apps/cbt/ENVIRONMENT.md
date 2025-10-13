# CBT Portal Environment Configuration

This application uses environment-specific configuration files to manage different deployment environments.

## Environment Files

- `.env` - Common/fallback environment variables
- `.env.development` - Development environment (used with `npm run dev`)
- `.env.staging` - Staging environment (used with `npm run build:staging`)
- `.env.production` - Production environment (used with `npm run build`)

## Available Scripts

- `npm run dev` - Start development server with development environment
- `npm run dev:local` - Start development server accessible from network
- `npm run build` - Build for production
- `npm run build:staging` - Build for staging environment
- `npm run preview` - Preview built application
- `npm run preview:production` - Preview with production environment

## Environment Variables

### API Configuration
- `VITE_API_BASE_URL` - Backend API base URL
- `VITE_SOCKET_URL` - WebSocket server URL (for real-time features)

### Application Settings
- `VITE_APP_NAME` - Application name displayed in UI
- `VITE_APP_VERSION` - Application version
- `VITE_APP_ENV` - Current environment (development, staging, production)
- `VITE_APP_DEBUG` - Enable debug mode (true/false)

### Feature Flags
- `VITE_ENABLE_DEV_TOOLS` - Enable development tools (true/false)
- `VITE_LOG_LEVEL` - Logging level (debug, info, warn, error)

## Environment Utility

Use the `Environment` utility in your code to access environment-specific values:

```javascript
import { Environment } from '../utils/environment.js'

// Check current environment
if (Environment.isDevelopment()) {
  // Development-specific code
}

// Get environment values
const apiUrl = Environment.getApiBaseUrl()
const isDebug = Environment.isDebugMode()

// Get all environment info
const envInfo = Environment.getInfo()
```

## Setup for Different Environments

### Development
```bash
npm run dev
```
Uses `.env.development` with local API server.

### Staging
```bash
npm run build:staging
```
Uses `.env.staging` with staging API server.

### Production
```bash
npm run build
```
Uses `.env.production` with production API server.