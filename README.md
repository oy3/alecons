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
- Node.js 18+ 
- MongoDB (for API)
- npm or yarn

### Installation & Setup

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd acons
   ./setup.sh
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development**:
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
```

### Production
```bash
# Deploy to production
./deploy-production.sh

# Start in production mode
npm run start:all
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
Key environment variables (see `.env.example`):

```bash
# API Configuration
API_PORT=8000
MONGODB_URI=mongodb://localhost:27017/alecons
JWT_SECRET=your-secret-key

# Frontend Ports
CBT_PORT=3004
APPLICATION_PORT=3000
STAFF_PORT=3001
STUDENT_PORT=3002

# Production URLs
API_BASE_URL=https://api.yourdomain.com
CBT_URL=https://cbt.yourdomain.com
```

### Workspace Configuration
This project uses npm workspaces for monorepo management. Each app and package has its own `package.json` with specific dependencies and scripts.

## 🚀 Deployment

### Development Deployment
```bash
npm run dev:all
```

### Production Deployment
```bash
./deploy-production.sh
./start-production.sh
```

### Docker Deployment (Optional)
```bash
# Build Docker images
docker-compose build

# Start all services
docker-compose up -d
```

## 📖 Documentation

Additional documentation available in:
- [Environment Setup](ENVIRONMENT_SETUP.md)
- [API Documentation](packages/api/README.md) 
- [Frontend Guidelines](docs/FRONTEND.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:all`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
