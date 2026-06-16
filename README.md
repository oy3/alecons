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

### Academic Program Model
- `Program` is the only source of truth for academic type and mode through `Program.programTypeId` and `Program.programModeId`.
- `Application` stores only `programId` for academic selection.
- `Student` stores only `programId` for academic selection.
- The applicant frontend still uses program type and mode as selection filters, but the persisted academic identity is the chosen `programId`.
- Any API or UI that needs type or mode resolves them through the linked program relation, not from top-level application or student fields.

### Program Relation Integrity
- `programTypeId + programModeId` is not a unique academic identity. Multiple programs can share the same combination.
- `programId` is the only persisted academic identity for applications and students.
- `Program Drift Repair` removes legacy top-level `programTypeId` and `programModeId` fields from `Application` and `Student` documents and reports broken `programId` relations.
- After a successful repair, `applications` and `students` in MongoDB should no longer contain top-level `programTypeId` or `programModeId` fields.

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

### Maintenance
```bash
# Repair program relation drift (staff portal + CLI utility)
# In Staff Portal Utilities page: select session, then click "Program Drift Repair"
# Or via CLI for dry-run + apply:
npm run util:repair-program-drift          # Dry run
npm run util:repair-program-drift --apply  # Apply
```

Expected repair outcome:
- `programId` remains on `Application` and `Student`.
- Top-level `programTypeId` and `programModeId` are removed from `Application` and `Student`.
- Type and mode continue to resolve through the linked `Program` document.

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
- Backend production secrets should not be committed; keep them on the Rootlab droplet in `/home/rootlab/apps/alecons/shared/env/.env.production`.
- The exam and background-job features also require Redis configuration in the API environment.
- Production file uploads require valid DigitalOcean Spaces configuration in the API environment.

### External Services

The API depends on these external services in production:

- MongoDB
- Redis for Bull queues and background jobs
- SMTP or equivalent mail transport for notifications
- DigitalOcean Spaces for uploaded files and payment receipts

### Payment Configuration
Manual transfer and Paystack availability are controlled from backend session controls managed in the staff portal per academic session.

Frontend payment-related env values:

```bash
VITE_PAYSTACK_PUBLIC_KEY=pk_live_or_test_key
```

Notes:
- The Paystack public key is still required on the frontend to launch Paystack checkout when the session control enables Paystack.
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
4. [`scripts/deploy/remote-deploy.sh`](scripts/deploy/remote-deploy.sh) extracts the release, updates the Rootlab symlinks under `/home/rootlab/apps/alecons`, syncs the frontend `dist` folders into `/home/rootlab/apps/alecons/current/*`, validates Google Chrome for Puppeteer, and reloads PM2.

The local [`deploy-production.sh`](deploy-production.sh) script is only a local production-style build helper. It is not the primary live deployment path.

Current live production contract:

- Droplet host: Rootlab
- Deploy user: `rootlab`
- App root: `/home/rootlab/apps/alecons`
- API PM2 app name: `alecons-api`
- API port: `8084`
- API runtime env file: `/home/rootlab/apps/alecons/shared/env/.env.production`

### Production Setup Checklist

The current production droplet does not keep a full checkout of this repository. GitHub Actions uploads release artifacts only.

Run the one-time droplet preparation as `root`, not as the deploy user, by copying the bootstrap script onto the droplet first:

```bash
scp scripts/deploy/prepare-droplet.sh root@your_droplet_ip:/root/
ssh root@your_droplet_ip
bash /root/prepare-droplet.sh
```

Required GitHub production environment values:

- `ROOTLAB_DEPLOY_HOST`
- `ROOTLAB_DEPLOY_PORT`
- `ROOTLAB_DEPLOY_USER`
- `ROOTLAB_DEPLOY_PATH`
- `ROOTLAB_SSH_PRIVATE_KEY`
- frontend `VITE_*` variables used by [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml)

Required GitHub production secrets for backend env sync:

- `DATABASE_URL`
- `JWT_SECRET`
- `PAYSTACK_SECRET_KEY`
- `SPACES_KEY`
- `SPACES_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `REDIS_PASSWORD`

Required GitHub production variables for backend env sync:

- `SPACES_BUCKET_NAME`
- `SPACES_CDN_URL`
- `SMTP_USER`

Optional GitHub production variables with safe deploy defaults:

- `SPACES_ENDPOINT` default: `https://lon1.digitaloceanspaces.com`
- `SPACES_REGION` default: `lon1`
- `REDIS_HOST` default: `localhost`
- `REDIS_PORT` default: `6379`
- `JWT_EXPIRATION` default: `24h`
- `PUPPETEER_EXECUTABLE_PATH` default: `/opt/google/chrome/google-chrome`
- `WEBSITE_URL` default: `VITE_APP_SITE_URL`
- `APPLICATION_PORTAL_URL` default: `VITE_APP_APPLICATION_PORTAL_URL`
- `STUDENT_PORTAL_URL` default: `VITE_APP_STUDENT_PORTAL_URL`
- `STAFF_PORTAL_URL` default: `VITE_APP_STAFF_PORTAL_URL`
- `CBT_PORTAL_URL` default: `VITE_APP_CBT_URL`

The production workflow now renders `/home/rootlab/apps/alecons/shared/env/.env.production` from GitHub production secrets and variables during deploy.

Important:

- Local `.env` files are not uploaded to Rootlab.
- The source of truth for production backend runtime config is now the GitHub `production` environment.
- The deploy uploads a staged backend env file, installs it on Rootlab, and restores the previous env file automatically if the deploy health check rolls back.
- Manual edits on Rootlab will be overwritten by the next successful production deploy.

For PDF generation, pin the browser explicitly in that file:

```bash
PUPPETEER_EXECUTABLE_PATH=/opt/google/chrome/google-chrome
```

### Process Ownership Rules

- `root` is only for one-time machine preparation: users, directories, sudoers, Google Chrome, nginx, certbot, and system packages.
- The live API process is owned by the `rootlab` user through PM2.
- `pm2 status` will show different process lists for `root` and `rootlab` because they use different PM2 homes.
- The workflow deploys and reloads PM2 as `rootlab`, not as `root`.

That means this is expected:

```bash
sudo -iu rootlab
pm2 status

pm2 logs alecons-api --err --lines 200
```

and this may show nothing useful for the app:

```bash
sudo -i
pm2 status
```

### Production Logs

To inspect the live ALECONS API logs on Rootlab:

```bash
ssh rootlab@your_rootlab_ip

# Stream combined PM2 logs for the app
pm2 logs alecons-api --lines 200

# Only stderr, which is where most startup failures appear
pm2 logs alecons-api --err --lines 200

# Tail the file-backed logs directly
tail -n 200 /home/rootlab/apps/alecons/logs/alecons-api-error-1.log
tail -n 200 /home/rootlab/apps/alecons/logs/alecons-api-out-1.log

# Follow new log entries live
tail -f /home/rootlab/apps/alecons/logs/alecons-api-error-1.log
```

To check specifically for the Gmail OAuth issue:

```bash
grep -n "invalid_grant" /home/rootlab/apps/alecons/logs/alecons-api-error-1.log
grep -n "Gmail API connection failed" /home/rootlab/apps/alecons/logs/alecons-api-error-1.log
```

Useful companion checks:

```bash
pm2 describe alecons-api
pm2 env 1
```

### Browser and PDF Generation

- Server-side PDFs use Puppeteer.
- Production prefers a non-snap Google Chrome binary on the droplet.
- [`scripts/deploy/prepare-droplet.sh`](scripts/deploy/prepare-droplet.sh) installs Google Chrome and grants the `rootlab` user passwordless `apt-get` so the deploy script can keep that browser present on future releases.
- Production should pin `PUPPETEER_EXECUTABLE_PATH=/opt/google/chrome/google-chrome` in `/home/rootlab/apps/alecons/shared/env/.env.production` so PM2 reloads do not depend on browser auto-detection.
- [`packages/api/src/utils/puppeteer-launch.util.ts`](packages/api/src/utils/puppeteer-launch.util.ts) rejects snap-wrapped browser launchers and refuses to use Puppeteer's cache in production.
- [`scripts/deploy/remote-deploy.sh`](scripts/deploy/remote-deploy.sh) smoke-tests Puppeteer against the selected browser before PM2 reload, clears stale Puppeteer cache by default, and exports the validated browser path into PM2.
- Optional bundled Puppeteer browser fallback is disabled by default and should remain off in production.

### Production Sanity Checks

Verify the live API owner and browser setup:

```bash
# port 8084 should be owned by the rootlab user
sudo lsof -i :8084 -P -n

# the live PM2 app should exist under the rootlab user
sudo -u rootlab pm2 list

# Google Chrome should be installed and runnable
sudo -u rootlab bash -lc 'command -v google-chrome-stable || command -v google-chrome'
sudo -u rootlab bash -lc 'google-chrome-stable --version 2>/dev/null || google-chrome --version'

# rootlab user should have passwordless apt-get if prepare-droplet.sh was run correctly
sudo -u rootlab sudo -n /usr/bin/apt-get --version
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

- `pm2 status` is empty as `root` but app is online as `rootlab`
   This is normal. Check PM2 under the `rootlab` user instead.

- `Failed to make admission decision` with a PDF generation stack trace
   This is server-side. Check Rootlab PM2 logs, Chromium availability, and `/home/rootlab/apps/alecons/shared/env/.env.production`.

- `MongooseServerSelectionError` or health check never comes up on `127.0.0.1:8084`
   Confirm MongoDB Atlas allows the Rootlab droplet public IP. The current Rootlab egress IP is `161.35.163.18`.

- `invalid_grant` in `alecons-api`
   Gmail OAuth credentials are loaded, but the refresh token or consent state is no longer valid. Check the `alecons-api` PM2 error log, refresh the Gmail OAuth token values in `/home/rootlab/apps/alecons/shared/env/.env.production`, then reload PM2.

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
