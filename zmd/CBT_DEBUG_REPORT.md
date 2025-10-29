# CBT Portal Exam Display Issue - Debug Report

## Issue Summary
User reported that when logging into CBT portal, scheduled exams are not showing up, even though they exist.

## Root Causes Identified

### 1. **API Response Format Mismatch**
- **Problem**: Backend was returning `{success: true, exams: [...]}` but frontend expected `{success: true, data: [...]}`
- **Fix Applied**: Updated `exam.controller.ts` to return `data` instead of `exams`

### 2. **Double Response Wrapping**
- **Problem**: CBT API service was double-wrapping the response, expecting raw array but getting structured object
- **Fix Applied**: Updated `apps/cbt/src/services/api.js` to handle new backend response format properly

### 3. **Missing Debug Information**
- **Problem**: No logging to track API calls and responses
- **Fix Applied**: Added comprehensive logging to both frontend and backend

## Files Modified

### Backend Changes
1. **`/packages/api/src/controllers/exam.controller.ts`**
   ```typescript
   // BEFORE
   return { success: true, exams };
   
   // AFTER  
   return { success: true, data: exams };
   ```

2. **`/packages/api/src/services/exam.service.ts`**
   - Added detailed logging for exam filtering
   - Added user/role debugging information
   - Added exam count and details logging

### Frontend Changes
1. **`/apps/cbt/src/services/api.js`**
   ```javascript
   // BEFORE: Expected raw array from backend
   return { success: true, data: response.data }
   
   // AFTER: Handle structured response
   if (response.data.success) {
       return { success: true, data: response.data.data || [] }
   }
   ```

2. **`/apps/cbt/src/views/Dashboard.vue`**
   - Added authentication state logging
   - Added API response debugging
   - Added exam count logging

## Testing Steps

### 1. Verify API Endpoint
```bash
# Test endpoint accessibility
curl http://localhost:8000/api/v1/exams/available
# Expected: 401 Unauthorized (requires auth)
```

### 2. Check Authentication
- Ensure user can login to CBT portal
- Verify JWT token is being sent with requests
- Check user role and permissions

### 3. Verify Exam Data
- Ensure there are exams with `status: 'scheduled'`
- Verify exam targeting matches user profile
- Check exam timing (examTimestamp)

### 4. Debug Console Output
When accessing CBT dashboard, check browser console for:
```
Loading exams... Auth state: {...}
Available exams API response: {...}
Loaded exams: X exams
```

## Current Status
- ✅ API response format fixed
- ✅ Frontend response handling updated
- ✅ Debugging logging added
- 🔄 Ready for testing

## Next Steps for Debugging

1. **Login to CBT Portal** (http://localhost:3004)
2. **Check Browser Console** for debug output
3. **Verify API Logs** in backend terminal
4. **Check Database** for scheduled exams with proper targeting

## Common Issues to Check

1. **No Scheduled Exams**: Exams might be in 'draft' status, need questions to become 'scheduled'
2. **Targeting Mismatch**: Exam target type doesn't match user role (student/applicant vs staff)
3. **Program ID Mismatch**: User's program doesn't match exam's target filter
4. **Authentication Issues**: JWT token expired or invalid
5. **Time Issues**: Exam timing logic might be filtering out available exams

## Database Queries for Manual Verification

```javascript
// Check for scheduled exams
db.exams.find({status: 'scheduled', isActive: true})

// Check user details
db.users.find({email: 'user@example.com'})

// Check user attempts
db.examattempts.find({userId: ObjectId('...')})
```