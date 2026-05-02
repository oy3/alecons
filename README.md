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

### Application Lifecycle
- The applicant journey is organized as a staged workflow from registration through application form, entrance exam, screening, admission decision, acceptance fee, sundry fee, school fee, and final completion.
- Admission and screening steps are staff-driven, while payment steps and document submission are applicant-driven.
- The admissions flow is tightly coupled to payment progression and student creation after completion.

### Payments
- **Dual payment flow**: Supports both Paystack and manual bank transfer for applicant and student charges
- **Manual transfer fallback**: Users can upload a receipt after transfer and keep moving while Paystack approval or gateway availability is pending
- **Receipt validation**: Manual transfer receipts accept PNG, JPG, or PDF files up to 1MB and are stored in DigitalOcean Spaces
- **Staff verification**: Staff review uploaded receipts from linked payment history and can verify or reject with remarks
- **Session-aware controls**: Academic session controls can enable or disable Paystack and manual transfer separately for applicants and students
- **Audience targeting**: Payments can be targeted by audience so applicants, students, academic staff, and admin staff only see the charges intended for them

### Examination System
- PDF question import and parsing
- Automatic exam scheduling and password generation
- Background jobs with Redis/Bull for reminders, grading, and result processing
- Timed exam reminders and automatic submission handling for expired attempts
- Real-time exam monitoring and auto-submission
- Comprehensive result analysis and reporting

### File Handling
- Applicant profile pictures are limited to 2MB
- Applicant PDF documents such as results and reference files are limited to 3MB
- Manual transfer payment receipts are limited to 1MB
- Production file storage uses DigitalOcean Spaces with optional CDN delivery

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
- The exam and background-job features also require Redis configuration in the API environment.
- Production file uploads require valid DigitalOcean Spaces configuration in the API environment.

### External Services

The API depends on these external services in production:

- MongoDB
- Redis for Bull queues and background jobs
- SMTP or equivalent mail transport for notifications
- DigitalOcean Spaces for uploaded files and payment receipts

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
```

Notes:
- If a method is disabled in session controls, the portal hides or blocks it even when the frontend env flag is `true`.
- Manual transfer receipt uploads depend on the API Spaces configuration being valid in production.
- Manual transfer bank details and Paystack destination routing are configured from destination accounts in the staff Payments screen, not frontend env files.
- Pending manual transfer payments show separately from unpaid fees until staff verification is completed.
- In automated production deploys, set the payment flags and public key in the GitHub `production` environment; destination account details stay in the database.

### Workspace Configuration
This project uses npm workspaces for monorepo management. Each app and package has its own `package.json` with specific dependencies and scripts.

## 🚀 Deployment

### Development Deployment
```bash
npm run dev:all
```

### Production Deployment

Production deploys are handled by [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml).

The production branch flow is:

1. GitHub Actions installs workspace dependencies and builds all frontend apps.
2. GitHub Actions builds the API and prepares a runtime artifact containing only `dist`, `package.json`, `ecosystem.config.cjs`, and production `node_modules`.
3. The workflow uploads `frontend-dist.tar.gz` and `api-release.tar.gz` to the droplet.
4. [`scripts/deploy/remote-deploy.sh`](scripts/deploy/remote-deploy.sh) extracts the release, updates `/home/api/current`, syncs the frontend `dist` folders into `/home/apps/*`, ensures Chromium is available, and reloads PM2.

The local [`deploy-production.sh`](deploy-production.sh) script is only a local production-style build helper. It is not the primary live deployment path.

### Production Setup Checklist

The current production droplet does not keep a full checkout of this repository. GitHub Actions uploads release artifacts only.

Run the one-time droplet preparation as `root`, not as the deploy user, by copying the bootstrap script onto the droplet first:

```bash
scp scripts/deploy/prepare-droplet.sh root@your_droplet_ip:/root/
ssh root@your_droplet_ip
bash /root/prepare-droplet.sh
```

Required GitHub production environment values:

- `DROPLET_HOST`
- `DROPLET_USER=deploy`
- `DROPLET_PORT`
- `DROPLET_SSH_KEY`
- frontend `VITE_*` variables used by [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml)

Keep production backend secrets only on the droplet in `/etc/alecons/api.env`.

For PDF generation, pin the browser explicitly in that file:

```bash
PUPPETEER_EXECUTABLE_PATH=/opt/google/chrome/google-chrome
```

### Process Ownership Rules

- `root` is only for one-time machine preparation: users, directories, sudoers, Google Chrome, nginx, certbot, and system packages.
- The live API process is owned by the `deploy` user through PM2.
- `pm2 status` will show different process lists for `root` and `deploy` because they use different PM2 homes.
- The workflow deploys and reloads PM2 as `deploy`, not as `root`.

That means this is expected:

```bash
sudo -iu deploy
pm2 status

pm2 logs alecons-api --err --lines 200
```

and this may show nothing useful for the app:

```bash
sudo -i
pm2 status
```

### Browser and PDF Generation

- Server-side PDFs use Puppeteer.
- Production prefers a non-snap Google Chrome binary on the droplet.
- [`scripts/deploy/prepare-droplet.sh`](scripts/deploy/prepare-droplet.sh) installs Google Chrome and grants the deploy user passwordless `apt-get` so the deploy script can keep that browser present on future releases.
- Production should pin `PUPPETEER_EXECUTABLE_PATH=/opt/google/chrome/google-chrome` in `/etc/alecons/api.env` so PM2 reloads do not depend on browser auto-detection.
- [`packages/api/src/utils/puppeteer-launch.util.ts`](packages/api/src/utils/puppeteer-launch.util.ts) rejects snap-wrapped browser launchers and refuses to use Puppeteer's cache in production.
- [`scripts/deploy/remote-deploy.sh`](scripts/deploy/remote-deploy.sh) smoke-tests Puppeteer against the selected browser before PM2 reload, clears stale Puppeteer cache by default, and exports the validated browser path into PM2.
- Optional bundled Puppeteer browser fallback is disabled by default and should remain off in production.

### Production Sanity Checks

Verify the live API owner and browser setup:

```bash
# port 8000 should be owned by the deploy user
sudo lsof -i :8000 -P -n

# the live PM2 app should exist under the deploy user
sudo -u deploy pm2 list

# Google Chrome should be installed and runnable
sudo -u deploy bash -lc 'command -v google-chrome-stable || command -v google-chrome'
sudo -u deploy bash -lc 'google-chrome-stable --version 2>/dev/null || google-chrome --version'

# deploy user should have passwordless apt-get if prepare-droplet.sh was run correctly
sudo -u deploy sudo -n /usr/bin/apt-get --version
```

Verify the API and CORS:

```bash
# API health
curl -fsS https://api.alecons.edu.ng/api/v1/health

# CORS preflight should allow the frontend origins
curl -i -X OPTIONS 'https://api.alecons.edu.ng/api/v1/auth/check-eligibility' \
   -H 'Origin: https://apply.alecons.edu.ng' \
   -H 'Access-Control-Request-Method: GET'

curl -i -X OPTIONS 'https://api.alecons.edu.ng/api/v1/auth/staff/login' \
   -H 'Origin: https://staff.alecons.edu.ng' \
   -H 'Access-Control-Request-Method: POST'
```

### Common Production Failures

- `No launchable non-snap browser is available for Puppeteer`
   Copy [`scripts/deploy/prepare-droplet.sh`](scripts/deploy/prepare-droplet.sh) to the droplet and run it as `root`.

- `libatk-1.0.so.0` or similar shared-library errors from Puppeteer
   Production is trying to use Puppeteer's cached browser instead of system Chrome, or the system browser installation is incomplete. Re-run the droplet bootstrap and redeploy.

- `... is not a snap cgroup for tag snap.chromium.chromium`
   The server is trying to launch a snap Chromium wrapper from PM2. Re-run the droplet bootstrap so production uses Google Chrome instead.

- `pm2 status` is empty as `root` but app is online as `deploy`
   This is normal. Check PM2 under the deploy user instead.

- `Failed to make admission decision` with a PDF generation stack trace
   This is server-side. Check deploy-user PM2 logs, Chromium availability, and `/etc/alecons/api.env`.

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
- [API Documentation](packages/api/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:all`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
