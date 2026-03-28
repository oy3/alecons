# ALECONS - Academic Learning & Examination Console System

A comprehensive educational platform built with Vue.js frontend applications and NestJS backend API, featuring multiple portals for different user types and a complete examination system.

## 🏗️ Project Structure

```
acons/
├── apps/
│   ├── application-portal/    # Student application portal
│   ├── cbt/                  # Computer-Based Testing portal
│   ├── staff-portal/         # Staff management portal
│   ├── student-portal/       # Student learning portal
│   └── website/              # Main website
├── packages/
│   ├── api/                  # NestJS backend API
│   └── shared/               # Shared components and utilities
└── scripts/                  # Build and deployment scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB (for API)
- npm

### Installation & Setup

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd acons
   ./setup.sh
   ```

2. **Configure environment**:
   ```bash
   cp packages/api/.env.example packages/api/.env
   cp apps/website/.env.example apps/website/.env.local
   cp apps/application-portal/.env.example apps/application-portal/.env.local
   cp apps/student-portal/.env.example apps/student-portal/.env.local
   cp apps/staff-portal/.env.example apps/staff-portal/.env.local
   cp apps/cbt/.env.example apps/cbt/.env.local
   ```

3. **Edit the copied env files** for your local setup.

4. **Start development**:
   ```bash
   npm run dev:all
   ```

## 📋 Available Commands

### Development
```bash
# Start all applications (API + Frontend)
npm run dev:all

# Start only frontend applications
npm run dev:frontend

# Start individual applications
npm run dev:api          # API server (port 8000)
npm run dev:cbt          # CBT Portal (port 3004)
npm run dev:application  # Application Portal (port 3000)
npm run dev:staff        # Staff Portal (port 3001)
npm run dev:student      # Student Portal (port 3002)
npm run dev:website      # Website (port 3003)

# If API building is giving issues
rm -rf dist tsconfig.build.tsbuildinfo && npm run build
```

### Installation
```bash
# Install all dependencies
npm run install:all

# Install workspace dependencies only
npm run install:workspaces
```

### Building
```bash
# Build all for production
npm run build:all

# Build API only
npm run build:api

# Build all frontend apps
npm run build:frontend

# Build individual apps
npm run build:cbt
npm run build:application
npm run build:staff
npm run build:student
npm run build:website
```

### Production
```bash
# Local production-style build check
./deploy-production.sh
```

### Testing
```bash
# Run all tests
npm run test:all

# Test API only
npm run test:api

# Test frontend apps
npm run test:frontend
```

### Maintenance
```bash
# Clean all node_modules and caches
npm run clean:all

# Clean workspace packages only
npm run clean:workspaces

# Lint/format all code
npm run lint:all
```

## 🌐 Development URLs

When running `npm run dev:all`, access applications at:

- **API Server**: http://localhost:8000
- **CBT Portal**: http://localhost:3004
- **Application Portal**: http://localhost:3000
- **Staff Portal**: http://localhost:3001
- **Student Portal**: http://localhost:3002

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vue.js 3 with Composition API
- **Build Tool**: Vite
- **Styling**: Bootstrap 5 + Custom CSS
- **Icons**: Bootstrap Icons
- **Notifications**: SweetAlert2
- **HTTP Client**: Axios

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with Passport
- **File Upload**: Multer + AWS S3
- **Email**: Nodemailer
- **Security**: bcrypt, rate limiting

## 📁 Key Features

### Multi-Portal Architecture
- **CBT Portal**: Computer-based testing with exam management
- **Application Portal**: Student admissions and applications  
- **Staff Portal**: Administrative functions and management
- **Student Portal**: Learning resources and progress tracking

### Payments
- **Dual payment flow**: Supports both Paystack and manual bank transfer for applicant and student charges
- **Manual transfer fallback**: Users can upload a receipt after transfer and keep moving while Paystack approval or gateway availability is pending
- **Receipt validation**: Manual transfer receipts accept PNG, JPG, or PDF files up to 1MB and are stored in DigitalOcean Spaces
- **Staff verification**: Staff review uploaded receipts from linked payment history and can verify or reject with remarks
- **Session-aware controls**: Academic session controls can enable or disable Paystack and manual transfer separately for applicants and students

### Examination System
- PDF question import and parsing
- Automatic exam scheduling and password generation
- Real-time exam monitoring and auto-submission
- Comprehensive result analysis and reporting

### Security Features
- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting and throttling
- File upload validation and scanning

## 🔧 Configuration

### Environment Variables
Use the per-app env templates that now live in the repo:

```bash
# API runtime template
packages/api/.env.example

# Frontend templates
apps/website/.env.example
apps/application-portal/.env.example
apps/student-portal/.env.example
apps/staff-portal/.env.example
apps/cbt/.env.example
```

Notes:
- Frontend `VITE_*` values are public build-time values and may live in GitHub Actions environment variables.
- Backend production secrets should not be committed; keep them on the droplet in `/etc/alecons/api.env`.

### Payment Configuration
Manual transfer and Paystack visibility are now controlled in two layers:

1. **Frontend build-time defaults** in:
   - `apps/application-portal/.env.example`
   - `apps/student-portal/.env.example`
2. **Backend session controls** managed from the staff portal per academic session

Frontend payment-related env values:

```bash
VITE_PAYSTACK_PUBLIC_KEY=pk_live_or_test_key
VITE_PAYMENT_PAYSTACK_ENABLED=true
VITE_PAYMENT_MANUAL_TRANSFER_ENABLED=true
VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NAME="Alecons College of Nursing Sciences"
VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NUMBER="0123456789"
VITE_PAYMENT_MANUAL_TRANSFER_BANK_NAME="Bank Name"
VITE_PAYMENT_MANUAL_TRANSFER_NOTE="Upload a clear receipt after making the transfer. Receipts must be PNG, JPG, or PDF and not more than 1MB."
```

Notes:
- If a method is disabled in session controls, the portal hides or blocks it even when the frontend env flag is `true`.
- Manual transfer receipt uploads depend on the API Spaces configuration being valid in production.
- Pending manual transfer payments show separately from unpaid fees until staff verification is completed.
- In automated production deploys, these `VITE_PAYMENT_*` values should be set in the GitHub `production` environment so the generated frontend `.env.production` files include the same payment fallback settings as local development.

### Workspace Configuration
This project uses npm workspaces for monorepo management. Each app and package has its own `package.json` with specific dependencies and scripts.

## 🚀 Deployment

### Development Deployment
```bash
npm run dev:all
```

### Production Deployment
- Production deploys are handled by [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml).
- A push or merge to the `production` branch builds the frontends in GitHub Actions, uploads the artifacts to the droplet, deploys the API release, and reloads PM2.
- The local [`deploy-production.sh`](deploy-production.sh) script is now just a local production-style build helper, not the primary deployment path.

### Production Runtime Notes
- The live ALECONS API should be managed by the `deploy` user via PM2, not by `root`.
- After migrating from an older manual deployment, do a one-time PM2 cutover so port `8000` is owned by `deploy` and points to `/home/api/current`.
- Keep production API secrets only in `/etc/alecons/api.env` and ensure that file can be sourced safely by bash.

### Post-Deploy Sanity Checks
```bash
# Port 8000 should be owned by deploy
sudo lsof -i :8000 -P -n

# deploy user's PM2 should own the live API
sudo -u deploy pm2 list

# CORS preflight should allow the frontend origins
curl -i -X OPTIONS 'https://api.alecons.edu.ng/api/v1/auth/check-eligibility' \
   -H 'Origin: https://apply.alecons.edu.ng' \
   -H 'Access-Control-Request-Method: GET'

curl -i -X OPTIONS 'https://api.alecons.edu.ng/api/v1/auth/staff/login' \
   -H 'Origin: https://staff.alecons.edu.ng' \
   -H 'Access-Control-Request-Method: POST'
```

### Payment Flow Sanity Checks
- Confirm the application portal and student portal can both load their payment pages successfully.
- Confirm staff can see the four session controls for payment methods:
   - Applicant Paystack Payments
   - Applicant Manual Transfer Payments
   - Student Paystack Payments
   - Student Manual Transfer Payments
- If Paystack is disabled for a session, confirm the portal blocks Paystack checkout for that session.
- If manual transfer is enabled, confirm account details are visible and receipt uploads accept PNG, JPG, or PDF files up to 1MB.
- Confirm newly submitted manual transfer payments appear as `Pending Verification` until staff approval.
- Confirm staff can verify or reject a pending manual transfer from linked payment history.

### Docker Deployment (Optional)
```bash
# Build Docker images
docker-compose build

# Start all services
docker-compose up -d
```

## 📖 Documentation

Additional documentation available in:
- [Automated Deployment Guide](DEPLOYMENT_AUTOMATION.md)
- [Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [API Documentation](packages/api/README.md)
- [Environment Setup Notes](zmd/ENVIRONMENT_SETUP.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:all`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
