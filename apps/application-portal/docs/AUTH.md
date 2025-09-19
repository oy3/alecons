# Authentication System Documentation

## Overview

This application implements a comprehensive authentication and route protection system for the Alecons education portal. The system ensures that only authenticated students can access protected pages and provides proper session management.

## Features Implemented

### 🔐 Authentication Manager (`src/services/auth.js`)
- **Centralized auth state management** using Vue 3 Composition API
- **Token management** with automatic expiration checking
- **Session persistence** using localStorage
- **Reactive auth state** for real-time UI updates
- **Automatic cleanup** on logout or token expiration

### 🛡️ Route Protection (`src/router/index.js`)
- **Navigation guards** that run before every route change
- **Guest-only routes** (login, register) - redirect authenticated users to dashboard
- **Protected routes** (dashboard, application-form, etc.) - require authentication
- **Role-based access** - ensures only applicants can access applicant routes
- **Automatic redirects** based on authentication status

### 🔑 Session Management
- **JWT token validation** with expiration checking
- **Automatic logout** on token expiration
- **Cross-component auth state** sharing
- **Persistent sessions** across browser refreshes

## Route Configuration

### Public Routes (Guest Only)
- `/` - Login Page
- `/register` - Registration Page

*Note: Authenticated users are automatically redirected to dashboard*

### Protected Routes (Requires Authentication)
- `/dashboard` - Student Dashboard
- `/application-form` - Application Form
- `/payment` - Payment Page  
- `/settings` - User Settings

### Special Routes
- `/logout` - Immediate logout and redirect to login
- `/*` (catch-all) - Smart redirect based on auth status

## Usage Examples

### In Components
```javascript
import { useAuth, authManager } from '@/services/auth.js';

export default {
  setup() {
    const { user, isAuthenticated, applicationId } = useAuth();
    
    return {
      user,           // Reactive user object
      isAuthenticated, // Reactive boolean
      applicationId   // Reactive application ID
    };
  },
  methods: {
    logout() {
      authManager.clearAuth();
      this.$router.push({ name: 'Login' });
    }
  }
}
```

### API Service Integration
- Automatic token inclusion in API requests
- Automatic logout on 401 responses
- Token refresh handling

## Security Features

### Token Security
- **JWT expiration validation** prevents use of expired tokens
- **Automatic cleanup** removes invalid sessions
- **Secure storage** in localStorage with proper cleanup

### Route Security
- **Before-route guards** prevent unauthorized access
- **Role validation** ensures users can only access appropriate content
- **Redirect protection** prevents infinite loops

### Session Security
- **Session validation** on every navigation
- **Token integrity checking** prevents tampered tokens
- **Automatic timeout** handling

## Authentication Flow

### Registration Flow
1. User fills registration form
2. API creates user account and generates JWT
3. AuthManager stores user data and token
4. User redirected to dashboard

### Login Flow
1. User provides email and password
2. API validates credentials and returns JWT
3. AuthManager stores session data
4. User redirected to dashboard

### Protected Route Access
1. User navigates to protected route
2. Route guard checks authentication status
3. If authenticated: allow access
4. If not authenticated: redirect to login

### Logout Flow
1. User clicks logout
2. AuthManager clears all session data
3. User redirected to login page

## Component Integration

### Dashboard Updates
- Shows personalized welcome message
- Displays real user data (name, email, application ID)
- Includes logout functionality
- Uses reactive auth state

### Navbar Updates
- Shows authenticated user's name
- Dropdown with user info and logout option
- Responsive design for mobile/desktop

## Testing the System

### Test Authentication Guards
1. **Direct URL access**: Try accessing `/dashboard` without logging in
2. **Authenticated user**: Login and try accessing `/` or `/register`
3. **Session persistence**: Refresh browser while logged in
4. **Logout functionality**: Use logout button or visit `/logout`

### Expected Behaviors
- ✅ Unauthenticated users → redirected to login
- ✅ Authenticated users → cannot access login/register
- ✅ Sessions persist across browser refreshes
- ✅ Expired tokens → automatic logout
- ✅ Real user data displayed in dashboard

## Files Modified/Created

### New Files
- `src/services/auth.js` - Authentication manager
- `docs/AUTH.md` - This documentation

### Modified Files
- `src/router/index.js` - Route guards and meta properties
- `src/services/api.js` - Integration with auth manager
- `src/views/login/Login.vue` - Auth manager integration
- `src/views/registration/Registration.vue` - Auth manager integration
- `src/views/dashboard/dashboard.vue` - User data and logout
- `src/components/Navbar.vue` - User dropdown and logout
- `src/main.js` - Auth manager initialization

## Security Best Practices Implemented

1. **No sensitive data in localStorage** - only user info and JWT
2. **Token expiration checking** - prevents stale session usage
3. **Automatic cleanup** - removes invalid sessions immediately
4. **Role-based access control** - users only see appropriate content
5. **Navigation protection** - guards prevent unauthorized access
6. **Graceful error handling** - proper redirects on auth failures

This authentication system provides a robust, secure foundation for the Alecons education portal with proper session management and route protection.
