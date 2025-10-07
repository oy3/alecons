# Application Schema Migration Guide

## Overview
This document outlines the migration from the flat application schema to the improved grouped structure with academic session integration and business rules.

## Schema Changes Summary

### 1. New Enums
```typescript
export enum AdmissionDecision {
    AWAITING_DECISION = 'pending',
    GRANTED = 'admitted',
    DENIED = 'rejected',
}
```

### 2. Grouped Field Structures

#### Before (Flat Structure):
```typescript
@Prop() examDate?: Date;
@Prop() examTime?: string;
@Prop() examLink?: string;
@Prop() examScore?: number;
@Prop() screeningDate?: Date;
@Prop() screeningTime?: string;
@Prop() screeningVenue?: string;
@Prop() isScreeningCompleted?: boolean;
```

#### After (Grouped Structure):
```typescript
@Prop({
    type: {
        date: Date,
        time: String,
        link: String,
        score: Number
    }
})
entranceExam?: EntranceExam;

@Prop({
    type: {
        date: Date,
        time: String,
        venue: String,
        completed: { type: Boolean, default: false }
    }
})
screening?: Screening;
```

### 3. Document Structure Changes

#### Before (Flat Array):
```typescript
@Prop({
    type: [{
        type: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        sittingIndex: { type: Number },
        referenceIndex: { type: Number }
    }]
})
documents: ApplicationDoc[];
```

#### After (Grouped Object):
```typescript
@Prop({
    type: {
        profilePicture: {
            type: { type: String },
            url: { type: String },
            uploadedAt: { type: Date, default: Date.now }
        },
        olevelResults: [{
            type: { type: String, required: true },
            url: { type: String, required: true },
            uploadedAt: { type: Date, default: Date.now }
        }],
        referenceLetters: [{
            type: { type: String, required: true },
            url: { type: String, required: true },
            uploadedAt: { type: Date, default: Date.now }
        }]
    },
    default: {
        olevelResults: [],
        referenceLetters: []
    }
})
documents: ApplicationDocuments;
```

### 4. Academic Session Integration
```typescript
@Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
entryAcademicSession: Types.ObjectId;
```

### 5. Audit Trail
```typescript
@Prop({ type: Types.ObjectId, ref: 'User' })
lastUpdatedBy?: Types.ObjectId;

@Prop()
lastUpdatedAt?: Date;
```

## Updated Academic Session Schema

```typescript
export enum SessionStatus {
    DRAFT = 'draft',
    OPEN = 'open',
    ONGOING = 'ongoing',
    CLOSED = 'closed',
}

@Schema({ timestamps: true })
export class AcademicSession {
    @Prop({ required: true, unique: true })
    sessionYear: string;

    @Prop({ default: false })
    applicationsOpen: boolean;

    @Prop({ required: true, enum: SessionStatus, default: SessionStatus.DRAFT })
    status: SessionStatus;

    @Prop({ default: false })
    active: boolean;
    
    // ... other fields
}
```

## Business Rules Implementation

### ApplicationEligibilityService
```typescript
async checkRegistrationEligibility(): Promise<EligibilityResult> {
    // 1. Check for active session with applicationsOpen = true
    const activeSession = await this.sessionModel.findOne({
        active: true,
        applicationsOpen: true,
        status: { $in: [SessionStatus.OPEN, SessionStatus.ONGOING] }
    });

    // 2. Check session controls
    const sessionControls = await this.sessionControlModel.findOne({
        academicSessionId: activeSession._id,
        isActive: true
    });

    // 3. Verify application control is active
    const applicationControl = sessionControls.controls.find(
        control => control.name === 'application' && control.active === true
    );

    return { eligible: !!applicationControl, activeSession };
}
```

## Migration Steps

### 1. Database Migration
```javascript
// MongoDB migration script
db.applications.updateMany(
    {},
    {
        $set: {
            "entranceExam": {
                "date": "$examDate",
                "time": "$examTime", 
                "link": "$examLink",
                "score": "$examScore"
            },
            "screening": {
                "date": "$screeningDate",
                "time": "$screeningTime",
                "venue": "$screeningVenue", 
                "completed": "$isScreeningCompleted"
            },
            "documents.profilePicture": null,
            "documents.olevelResults": [],
            "documents.referenceLetters": [],
            "admissionDecision": "pending"
        },
        $unset: {
            "examDate": 1,
            "examTime": 1,
            "examLink": 1, 
            "examScore": 1,
            "screeningDate": 1,
            "screeningTime": 1,
            "screeningVenue": 1,
            "isScreeningCompleted": 1
        }
    }
);

// Migrate documents array to grouped structure
db.applications.find({}).forEach(function(app) {
    const newDocs = {
        olevelResults: [],
        referenceLetters: []
    };
    
    if (app.documents) {
        app.documents.forEach(function(doc) {
            if (doc.type === 'profile_picture') {
                newDocs.profilePicture = {
                    type: doc.type,
                    url: doc.url,
                    uploadedAt: doc.uploadedAt
                };
            } else if (doc.type === 'olevel_result') {
                newDocs.olevelResults.push({
                    type: doc.type,
                    url: doc.url,
                    uploadedAt: doc.uploadedAt
                });
            } else if (doc.type === 'reference_letter') {
                newDocs.referenceLetters.push({
                    type: doc.type,
                    url: doc.url,
                    uploadedAt: doc.uploadedAt
                });
            }
        });
    }
    
    db.applications.updateOne(
        { _id: app._id },
        { $set: { documents: newDocs } }
    );
});
```

### 2. Controller Updates

#### Before:
```typescript
application.examDate = new Date(examData.examDate);
application.examTime = examData.examTime;
application.examLink = examData.examLink;
```

#### After:
```typescript
application.entranceExam = {
    date: new Date(examData.examDate),
    time: examData.examTime,
    link: examData.examLink
};
```

### 3. Frontend Updates

#### Document Access:
```javascript
// Before
const profilePic = application.documents.find(doc => doc.type === 'profile_picture');
const olevelDocs = application.documents.filter(doc => doc.type === 'olevel_result');

// After  
const profilePic = application.documents.profilePicture;
const olevelDocs = application.documents.olevelResults;
```

#### Exam Data Access:
```javascript
// Before
const examDate = application.examDate;
const examTime = application.examTime;

// After
const examDate = application.entranceExam?.date;
const examTime = application.entranceExam?.time;
```

## Implementation Checklist

### ✅ Backend Completed
- [x] Updated Application schema with grouped fields
- [x] Added AdmissionDecision enum  
- [x] Updated AcademicSession schema
- [x] Created ApplicationEligibilityService
- [x] Updated StaffApplicationsController methods
- [x] Updated ApplicationUploadController document handling

### 🔄 Backend In Progress  
- [ ] Add ApplicationEligibilityService to registration flow
- [ ] Update all controllers to use new grouped fields
- [ ] Add academic session validation in application creation
- [ ] Implement session controls validation
- [ ] Update aggregation pipelines for new structure

### 📋 Frontend TODO
- [ ] Update application form to use grouped document structure  
- [ ] Update exam and screening display components
- [ ] Add academic session validation to registration
- [ ] Update staff portal to use new field structure
- [ ] Update document upload/display logic
- [ ] Add admission decision enum handling

### 🧪 Testing TODO
- [ ] Write migration tests
- [ ] Test business rule validations
- [ ] Test document structure changes
- [ ] Test academic session workflows
- [ ] End-to-end workflow testing

## Benefits of New Structure

1. **Better Organization**: Related fields are grouped together
2. **Type Safety**: Proper interfaces for grouped objects  
3. **Academic Session Control**: Proper session-based application management
4. **Business Rules**: Clear validation logic for registration eligibility
5. **Audit Trail**: Track who made changes and when
6. **Scalability**: Easier to add new fields to existing groups
7. **Maintainability**: Cleaner code with logical field grouping

## Rollback Plan

If issues arise, the migration can be reversed:
1. Run reverse migration script to flatten grouped fields
2. Revert controller changes to use flat field access  
3. Update frontend to use original field names
4. Restore original document array structure

This structured approach ensures a smooth transition to the improved schema while maintaining data integrity and system functionality.