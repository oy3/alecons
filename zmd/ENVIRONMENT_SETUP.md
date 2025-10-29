# Alecons Environment Configuration Guide

This document outlines the environment configuration setup for all applications in the Alecons project.

## Project Structure

```
alecons/
├── apps/
│   ├── application-portal/    # Student application portal
│   ├── cbt/                  # Computer-Based Testing system
│   ├── staff-portal/         # Staff management portal
│   ├── student-portal/       # Student portal (if exists)
│   └── website/              # Public website
└── packages/
    └── api/                  # Backend API server
```

## Environment Files Structure

Each frontend application should have:
- `.env` - Common/fallback variables
- `.env.development` - Development environment
- `.env.production` - Production environment
- `.env.staging` - Staging environment (optional)

## Environment Variables Standards

### API Configuration
- **Application Portal**: `VITE_APP_API_URL`
- **CBT Portal**: `VITE_API_BASE_URL`
- **Staff Portal**: `VITE_API_URL`
- **Standard**: `http://localhost:8000/api/v1` (dev) | `https://api.alecons.edu.ng/api/v1` (prod)

### Application Settings
- `VITE_APP_TITLE` / `VITE_APP_NAME` - Application display name
- `VITE_APP_ENV` - Environment identifier (development/staging/production)
- `VITE_APP_DEBUG` - Enable debug mode (true/false)
- `VITE_APP_VERSION` - Application version

### Development Features
- `VITE_ENABLE_DEV_TOOLS` - Enable development tools
- `VITE_LOG_LEVEL` - Logging level (debug/info/warn/error)

### External Services
- `VITE_PAYSTACK_PUBLIC_KEY` - Payment gateway key
- `VITE_SOCKET_URL` - WebSocket server URL

## Current Application Status

### ✅ Application Portal
- **Status**: ✅ Fully configured
- **Environment Files**: `.env`, `.env.development`, `.env.production`
- **API Variable**: `VITE_APP_API_URL`
- **Additional**: Paystack integration, student portal URL

### ✅ CBT Portal
- **Status**: ✅ Newly configured
- **Environment Files**: `.env`, `.env.development`, `.env.production`, `.env.staging`
- **API Variable**: `VITE_API_BASE_URL`
- **Features**: Environment utility, debug logging, timeout configuration

### ✅ Staff Portal
- **Status**: ✅ Enhanced
- **Environment Files**: `.env.development`, `.env.production`
- **API Variable**: `VITE_API_URL`
- **Features**: Basic environment setup

### ⏳ Student Portal
- **Status**: ⏳ Needs verification
- **Location**: `apps/student-portal/`

### ⏳ Website
- **Status**: ⏳ Needs verification
- **Location**: `apps/website/`

## Development Commands

### Application Portal
```bash
npm run dev          # Development mode
npm run build        # Production build
npm run build:staging # Staging build
```

### CBT Portal
```bash
npm run dev              # Development mode
npm run dev:local        # Development with network access
npm run build            # Production build
npm run build:staging    # Staging build
npm run preview          # Preview build
npm run preview:production # Preview production build
```

### Staff Portal
```bash
npm run dev          # Development mode
npm run build        # Production build
```

## Backend API
- **Development**: `http://localhost:8000`
- **Production**: `https://api.alecons.edu.ng`
- **API Prefix**: `/api/v1`

## Recommendations

1. **Standardize API variable names** across all applications
2. **Add environment utility** to other applications (similar to CBT portal)
3. **Implement consistent logging** using shared logger utility
4. **Add staging environment** to all applications
5. **Create environment validation** scripts
6. **Document deployment procedures** for each environment

## Security Notes

- Never commit `.env.local` files
- Keep production keys secure
- Use environment-specific API keys
- Validate environment variables on startup

## Next Steps

1. Audit remaining applications (student-portal, website)
2. Standardize variable naming conventions
3. Add environment validation utilities
4. Create deployment automation scripts
5. Document production deployment procedures