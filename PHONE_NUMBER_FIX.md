# Phone Number Registration Fix

## Issue Identified
During user registration, the phone number was being collected but was **NOT being saved to the Application collection**. Additionally, there was incorrect code attempting to save phone numbers to the User collection, which should not store application-specific data.

## Architecture Decision
Phone numbers should be stored **ONLY in the Application collection**, not in the User collection, because:
- Phone numbers are application-specific data
- Users may have different phone numbers for different applications
- Maintains separation of concerns between user account data and application data

## Root Cause
In `/packages/api/src/auth/auth.service.ts`, the `register()` method had two issues:
1. Phone number was not being saved to Application collection ❌
2. Phone number was incorrectly being attempted to save to User collection ❌

## Fix Applied
**File**: `/packages/api/src/auth/auth.service.ts`

### 1. Removed Phone from User Creation
**Before**:
```typescript
const user = new this.userModel({
    email,
    passwordHash: password,
    firstName,
    otherName,
    lastName,
    phone, // ❌ INCORRECT - User schema doesn't have phone field
    role: UserRole.APPLICANT,
    // ...
});
```

**After**:
```typescript
const user = new this.userModel({
    email,
    passwordHash: password,
    firstName,
    otherName,
    lastName,
    // phone removed - belongs in application only
    role: UserRole.APPLICANT,
    // ...
});
```

### 2. Added Phone to Application Creation
**Before**:
```typescript
// Add optional fields if provided
if (dateOfBirth) applicationData.dob = new Date(dateOfBirth);
if (gender) applicationData.gender = gender;
// phone missing ❌
```

**After**:
```typescript
// Add optional fields if provided
if (dateOfBirth) applicationData.dob = new Date(dateOfBirth);
if (gender) applicationData.gender = gender;
if (phone) applicationData.phone = phone; // ✅ ADDED
```

### 3. Removed Phone from Registration Response
**Before**:
```typescript
user: {
    // ... user fields
    phone: phone, // ❌ INCORRECT - phone not part of user data
}
```

**After**:
```typescript
user: {
    // ... user fields
    // phone removed - not part of user data
}
```

## Impact of Fix

### ✅ Correct Data Storage
- **User Collection**: Contains only account-related data (email, name, password, etc.)
- **Application Collection**: Contains application-specific data including phone number
- **Clear Separation**: User account data vs application-specific data

### ✅ Data Flow After Fix
1. **User Registration**:
   - User data saved to User collection (no phone) ✅
   - Phone saved to Application collection ✅

2. **Login**:
   - User data from User collection ✅
   - Phone number retrieved from Application collection ✅

3. **Application Form**:
   - Phone number pre-populated from Application collection ✅
   - User can update phone number ✅
   - Updated phone saves to Application collection ✅

### 📊 Benefits
- **Proper Architecture**: Clear separation of user vs application data
- **Data Integrity**: Phone numbers stored in the correct location
- **Consistency**: All application-specific data in one collection
- **Flexibility**: Users can have different phone numbers per application

## Verification
- Build successful ✅
- No breaking changes ✅
- Follows proper data architecture ✅
- Phone numbers only in Application collection ✅

## Related Files
- `/packages/api/src/auth/auth.service.ts` - Registration & login logic (FIXED)
- `/packages/api/src/schemas/user.schema.ts` - User model (no phone field) ✅
- `/packages/api/src/schemas/application.schema.ts` - Application model with phone field ✅
- `/packages/api/src/controllers/application-upload.controller.ts` - Application form submission ✅