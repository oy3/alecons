# Alecons API Backend

Backend API for the Alecons Application Portal built with NestJS, MongoDB, and JWT authentication.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- MongoDB running locally or connection string
- npm or yarn

### Local MongoDB with transactions on macOS

If you want local registration and other atomic write flows to use MongoDB transactions, run MongoDB as a single-node replica set instead of a standalone server.

1. Ensure MongoDB is installed via Homebrew:
```bash
brew install mongodb-community
```

2. Enable replica set mode in `/opt/homebrew/etc/mongod.conf`:
```yaml
replication:
  replSetName: rs0
```

3. Restart the service or your active launch agent:
```bash
brew services restart mongodb-community
```

If you use a custom launch agent instead of the Homebrew service, restart that agent after editing the config so `mongod` reloads the new settings.

4. Initialize the single-node replica set once:
```bash
mongosh --eval "rs.initiate({_id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }]})"
```

5. Verify the node becomes primary:
```bash
mongosh --eval "rs.status().members.map(m => ({ name: m.name, stateStr: m.stateStr }))"
```

Expected result should include `PRIMARY` for `127.0.0.1:27017`.

### Installation & Setup

1. **Install dependencies:**
```bash
cd packages/api
npm install
```

2. **Environment setup:**
```bash
cp .env.example .env
```

3. **Configure your `.env` file:**
```env
# Database
DATABASE_URL=mongodb://127.0.0.1:27017/alecons?replicaSet=rs0

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=7d

# Server
PORT=8000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:5173
```

4. **Start the server:**
```bash
npm run start:dev
```

The API will be running at `http://localhost:8000`

## 📚 API Documentation

Interactive Swagger documentation: `http://localhost:8000/api/docs`

## 🔗 Frontend Integration

Update your Vue.js frontend environment:

```bash
# In apps/application-portal/.env.development
VITE_APP_API_URL=http://localhost:8000/api/v1
```

### Example Frontend Usage:

```javascript
// Registration
const response = await fetch('http://localhost:8000/api/v1/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'student@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe'
  })
});

// Login
const loginResponse = await fetch('http://localhost:8000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'student@example.com',
    password: 'password123'
  })
});
```

## 🔐 Available Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login

### Health Check
- `GET /api/v1/` - Basic health check
- `GET /api/v1/health` - Detailed health status

## 📊 Database Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts (applicants, students, staff) |
| `applications` | Student applications with biodata |
| `students` | Student records after admission |
| `staffs` | Staff records with roles |
| `roles` | Permission-based roles |
| `departments` | Academic departments |
| `programs` | Academic programs |
| `payments` | Payment types and transactions |
| `academicSessions` | Academic year management |

## 🛠 Development

**TypeScript Note:** The backend uses TypeScript but the syntax is very similar to JavaScript. Main differences:
- Type annotations (optional): `name: string`
- Interface definitions for data structure
- Better error checking and IntelliSense

**Commands:**
```bash
npm run start:dev    # Development with hot reload
npm run build        # Build for production  
npm run start:prod   # Run production build
```

## Utilities

### Repair Program Drift

Use this utility to remove legacy top-level `programTypeId` and `programModeId` fields from
`Application` and `Student` records and report any broken `programId` relations.

```bash
# Dry run (no writes)
npm run util:repair-program-drift

# Apply changes
npm run util:repair-program-drift -- --apply
```

The command prints a summary including scanned records, legacy-field drift counts, and anomaly counts
(e.g., missing programs or missing program configuration).

## 🔄 User Flow

1. **Registration:** User registers → Auto-creates application record
2. **Login:** Returns JWT token + user info + applicationId
3. **Application:** User fills biodata using applicationId
4. **Admission:** Staff processes applications
5. **Student Creation:** Completed applications become student records

## 🏗 Project Structure

```
src/
├── auth/           # Authentication (register/login)
├── schemas/        # Database models
├── main.ts         # App entry point
└── app.module.ts   # Main module configuration
```
