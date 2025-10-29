# CBT System Setup and Testing Guide

## 📋 Prerequisites

Before running the CBT system, ensure you have:

1. **Node.js** (v16+)
2. **MongoDB** (local or cloud instance)
3. **Redis** (for background job processing)
4. **Git** (for version control)

## 🚀 Quick Start

### 1. Environment Setup

Create `.env` file in `/packages/api/`:

```bash
# Database
DATABASE_URL=mongodb://localhost:27017/alecons
# or for MongoDB Atlas:
# DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/alecons

# Redis (for Bull queues)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRATION=7d

# Email Configuration (if needed for notifications)
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 2. Install Dependencies

```bash
# Root level (installs all workspace dependencies)
npm install

# Install API specific dependencies
cd packages/api
npm install

# Install CBT app dependencies
cd ../../apps/cbt
npm install
```

### 3. Start Required Services

#### Start MongoDB (if local)
```bash
# Using Homebrew on macOS
brew services start mongodb-community

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

#### Start Redis (if local)
```bash
# Using Homebrew on macOS
brew services start redis

# Or using Docker
docker run -d -p 6379:6379 --name redis redis:alpine
```

### 4. Start the Services

Open 3 terminal windows/tabs:

#### Terminal 1: Start API Server
```bash
cd packages/api
npm run start:dev
```

#### Terminal 2: Start CBT Frontend
```bash
cd apps/cbt
npm run dev
```

#### Terminal 3: Start Staff Portal (for admin features)
```bash
cd apps/staff-portal
npm run dev
```

## 🔧 Service URLs

Once running, your services will be available at:

- **CBT Frontend**: http://localhost:3004
- **Staff Portal**: http://localhost:5175  
- **API Server**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api (Swagger UI)

## 📝 Testing the CBT System

### Phase 1: Basic API Testing

#### 1. Check API Health
```bash
curl http://localhost:3000/health
```

#### 2. Test Exam Endpoints (requires authentication)
```bash
# Get available exams (requires JWT token)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/exams/available

# Create exam (staff/admin only)
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Sample CBT Exam",
       "description": "Test exam for CBT system",
       "duration": 60,
       "totalQuestions": 10,
       "passingPercentage": 60,
       "examTimestamp": "2025-10-15T10:00:00Z"
     }' \
     http://localhost:3000/exams
```

### Phase 2: Frontend Testing

#### 1. CBT User Interface Testing

**Access CBT Portal**: http://localhost:3004

**Test Flow**:
1. **Login Page**: Test authentication
2. **Dashboard**: View available exams
3. **Exam Start**: Test password entry and validation
4. **Exam Interface**: 
   - Test full-screen mode
   - Test timer functionality
   - Test auto-save feature
   - Test security violations (tab switching)
   - Test question navigation
5. **Exam Submission**: Test final submission
6. **Results View**: Check results display

#### 2. Staff Portal Testing

**Access Staff Portal**: http://localhost:5175

**Admin Features**:
1. **Exam Management**: Create, edit, delete exams
2. **Question Bank**: Add questions to exams
3. **Password Management**: Generate exam passwords
4. **Results Management**: View and release results
5. **Statistics**: View exam analytics

### Phase 3: Advanced Testing

#### 1. Security Testing

**Test Security Features**:
```javascript
// In browser console during exam
// Test tab switching detection
window.blur();

// Test right-click prevention
document.addEventListener('contextmenu', (e) => {
  console.log('Right-click detected:', e.preventDefault());
});

// Test full-screen exit detection
document.addEventListener('fullscreenchange', () => {
  console.log('Fullscreen status:', document.fullscreenElement);
});
```

#### 2. Performance Testing

**Auto-save Testing**:
- Take an exam and monitor network tab for auto-save requests
- Should see save requests every 30 seconds
- Verify data persistence on page refresh

**Timer Testing**:
- Set a short exam duration (2-3 minutes)
- Verify countdown accuracy
- Test auto-submission when time expires

#### 3. Background Jobs Testing

**Grading Queue Testing**:
```bash
# Submit an exam and check job processing
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "attemptId": "ATTEMPT_ID",
       "answers": [...],
       "securityViolations": [],
       "submittedAt": "2025-10-12T10:00:00Z"
     }' \
     http://localhost:3000/exams/EXAM_ID/submit

# Check job status
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/exams/jobs/grading/JOB_ID
```

## 🧪 Test Data Creation

### Create Sample Exam Data

```javascript
// Sample exam creation via API
const sampleExam = {
  title: "Computer Science CBT",
  description: "Comprehensive computer science examination",
  duration: 90, // minutes
  totalQuestions: 20,
  passingPercentage: 70,
  examTimestamp: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
  status: "scheduled",
  target: {
    type: "student",
    filter: {}
  },
  settings: {
    allowResume: true,
    shuffleQuestions: false,
    showResults: true,
    negativeMarking: false
  },
  attemptLimit: 1
};
```

### Create Sample Questions

```javascript
// Sample MCQ question
const mcqQuestion = {
  examId: "EXAM_ID",
  questionText: "What is the time complexity of binary search?",
  type: "mcq",
  options: {
    a: "O(n)",
    b: "O(log n)",
    c: "O(n²)",
    d: "O(1)"
  },
  answer: "b",
  mark: 2,
  order: 1
};

// Sample multi-select question
const multiQuestion = {
  examId: "EXAM_ID",
  questionText: "Which of the following are programming languages?",
  type: "multi",
  options: {
    a: "JavaScript",
    b: "HTML",
    c: "Python",
    d: "CSS"
  },
  answer: ["a", "c"],
  mark: 3,
  order: 2
};
```

## 🔍 Troubleshooting

### Common Issues

#### 1. **MongoDB Connection Error**
```bash
Error: Cannot connect to MongoDB
```
**Solution**: Ensure MongoDB is running and connection string is correct

#### 2. **Redis Connection Error**
```bash
Error: Redis connection failed
```
**Solution**: Start Redis service or update Redis configuration

#### 3. **JWT Authentication Errors**
```bash
Error: Invalid token
```
**Solution**: Check JWT_SECRET in .env file and ensure user is authenticated

#### 4. **Port Conflicts**
```bash
Error: Port already in use
```
**Solution**: 
- Change ports in package.json scripts
- Kill existing processes: `lsof -ti:3000 | xargs kill`

#### 5. **Frontend Build Errors**
```bash
Error: Module not found
```
**Solution**: Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Debug Mode

#### Enable Detailed Logging
```bash
# API with verbose logging
cd packages/api
npm run start:dev:verbose

# Frontend with debug info
cd apps/cbt
NODE_ENV=development npm run dev
```

#### Monitor Background Jobs
```bash
# Install Redis CLI to monitor queues
redis-cli monitor

# Or use Bull Dashboard (install separately)
npm install -g bull-dashboard
bull-dashboard
```

## 📊 Monitoring and Analytics

### Check System Health
```bash
# API health check
curl http://localhost:3000/health

# MongoDB connection status
mongosh --eval "db.adminCommand('ping')"

# Redis status
redis-cli ping
```

### View Application Logs
```bash
# API logs
cd packages/api && npm run start:dev

# Frontend logs
cd apps/cbt && npm run dev

# MongoDB logs (if local)
tail -f /usr/local/var/log/mongodb/mongo.log
```

## 🎯 Next Steps

After successful testing:

1. **Production Deployment**: Configure for production environment
2. **Security Hardening**: Implement additional security measures
3. **Performance Optimization**: Add caching and optimization
4. **Monitoring Setup**: Implement application monitoring
5. **Backup Strategy**: Set up database backup procedures

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API documentation at http://localhost:3000/api
3. Check application logs for detailed error messages
4. Verify all environment variables are set correctly

---

**Happy Testing! 🚀**