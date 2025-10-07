# Enhanced Application Process Implementation

## Overview
This document outlines the implementation of the updated 10-stage application process for Alebiosu College of Nursing Services (ACON). The new workflow provides a comprehensive journey from registration to matriculation with automated email notifications and staff management capabilities.

## New Application Workflow Stages

### 1. Registration & Email Verification (Stage 1)
- **Student Action**: Register on the portal
- **System Action**: Send verification email
- **Email Template**: `sendVerificationEmail()`
- **Next Stage**: Form Fee Payment (Stage 2)

### 2. Form Fee Payment (Stage 2)
- **Student Action**: Pay application form fee via Paystack
- **System Action**: Process payment and advance stage
- **Payment Code**: `portalFee`
- **Next Stage**: Application Form (Stage 3)

### 3. Application Form (Stage 3)
- **Student Action**: Complete application form and upload documents
- **System Action**: Validate and save application data
- **Next Stage**: Entrance Exam (Stage 4)

### 4. Online Entrance Exam (Stage 4)
- **Admin Action**: Schedule exam via staff portal
- **System Action**: Send exam details to student
- **Email Template**: `sendEntranceExamScheduledEmail()`
- **API Endpoint**: `PATCH /staff/applications/:id/schedule-exam`
- **Next Stage**: Screening & Interview (Stage 5)

### 5. Screening & Interview (Stage 5)
- **Admin Action**: Schedule physical screening/interview
- **System Action**: Send screening details to student
- **Email Template**: `sendScreeningScheduledEmail()`
- **API Endpoint**: `PATCH /staff/applications/:id/schedule-screening`
- **Next Stage**: Admission Decision (Stage 6)

### 6. Awaiting Admission Decision (Stage 6)
- **Admin Action**: Make admission decision (admit/reject)
- **System Action**: Send admission letter or rejection email
- **Email Templates**: `sendAdmissionLetterEmail()` or `sendRejectionEmail()`
- **API Endpoint**: `PATCH /staff/applications/:id/admission-decision`
- **Next Stage**: Acceptance Fee (Stage 7) if admitted

### 7. Acceptance Fee Payment (Stage 7)
- **Student Action**: Pay acceptance fee to confirm admission
- **System Action**: Process payment and advance stage
- **Payment Code**: `acceptanceFee`
- **Next Stage**: Sundry Fee (Stage 8)

### 8. Sundry Fee Payment (Stage 8)
- **Student Action**: Pay administrative and sundry charges
- **System Action**: Process payment and advance stage
- **Payment Code**: `sundryFee`
- **Next Stage**: School Fees (Stage 9)

### 9. School Fee Payment (Stage 9)
- **Student Action**: Pay tuition and other school fees
- **System Action**: Process payment and advance stage
- **Payment Code**: `schoolFee`
- **Next Stage**: Completed (Stage 10)

### 10. Application Complete (Stage 10)
- **System Action**: Generate matriculation number and create student record
- **Email Template**: `sendMatriculationEmail()`
- **Matriculation Format**: `ALC/{YY}/{program.code}-nnnn` (e.g., ALC/25/01-0001)
- **Student Role**: Update user role to 'student'

## Technical Implementation

### Database Schema Updates

#### Application Schema (`application.schema.ts`)
```typescript
// New fields added for enhanced workflow
@Prop() examDate?: Date;
@Prop() examTime?: string;
@Prop() examLink?: string;
@Prop() examScore?: number;
@Prop() screeningDate?: Date;
@Prop() screeningTime?: string;
@Prop() screeningVenue?: string;
@Prop() isScreeningCompleted?: boolean;
@Prop() admissionDecision?: string;
@Prop() admissionLetter?: string;
@Prop() rejectionReason?: string;
@Prop() matriculationNumber?: string;
```

#### Student Schema (`student.schema.ts`)
```typescript
// Updated format for matriculation number
@Prop({ required: true, unique: true })
matriculationNumber: string; // New format: ALC/25/01-0001

@Prop({ required: true })
admissionYear: number;

@Prop({ required: true })
academicSession: string; // e.g., "2025/2026"
```

### Email Service Enhancements (`email.service.ts`)

#### New Email Templates
1. `sendEntranceExamScheduledEmail()` - Exam scheduling notification
2. `sendScreeningScheduledEmail()` - Screening appointment notification
3. `sendAdmissionLetterEmail()` - Admission offer with letter download
4. `sendRejectionEmail()` - Rejection notification with feedback
5. `sendMatriculationEmail()` - Final completion with matric number

### API Endpoints

#### Staff Applications Controller (`staff-applications.controller.ts`)
```typescript
// New endpoints for enhanced workflow management
PATCH /staff/applications/:id/schedule-exam
PATCH /staff/applications/:id/schedule-screening
PATCH /staff/applications/:id/admission-decision
PATCH /staff/applications/:id/complete-screening
PATCH /staff/applications/:id/generate-matric
```

### Payment System Updates

#### Updated Payment Stages (`payments.service.ts`)
```typescript
const stageProgressions = {
    'portalFee': 3,      // Form fee -> Application form
    'acceptanceFee': 8,  // Acceptance fee -> Sundry fees
    'sundryFee': 9,      // Sundry fee -> School fees
    'schoolFee': 10      // School fee -> Completed
};
```

#### Automatic Completion
- When school fee payment is completed, system automatically:
  - Generates matriculation number
  - Updates application status to 'completed'
  - Creates student record (logged for now)
  - Updates user role to 'student' (logged for now)
  - Sends matriculation email (logged for now)

### Frontend Updates

#### Application Portal Dashboard (`dashboard.vue`)
- Updated to 10-stage workflow
- New stage descriptions
- Updated payment stage mapping
- Enhanced resume button logic

#### Payment System (`payment.vue`)
- Added sundry fee payment option
- Updated stage availability logic
- New payment codes integration

### Services Created

#### MatriculationService (`matriculation.service.ts`)
```typescript
// Generates matriculation numbers in format: ALC/YY/program.code-nnnn
generateMatriculationNumber(programCode: string, year?: number): string
validateMatriculationNumber(matricNumber: string): boolean
parseMatriculationNumber(matricNumber: string): ParsedMatricNumber
```

## Email Templates Standardization

All email templates follow a consistent design with:
- ACON branding and colors
- Responsive HTML layout
- Clear call-to-action buttons
- Contact information footer
- Professional styling

## Stage Flow Summary

```
1. Registration → Email Verification
2. Form Fee Payment
3. Application Form Completion
4. Entrance Exam (Admin Scheduled)
5. Screening & Interview (Admin Scheduled)
6. Admission Decision (Admin Decision)
7. Acceptance Fee Payment
8. Sundry Fee Payment
9. School Fee Payment
10. Completed (Auto-generated Matric Number)
```

## Implementation Status

### ✅ Completed
- Application schema updates
- Email service with all templates
- Student schema updates
- Matriculation service
- Staff applications controller endpoints
- Payment system updates
- Frontend dashboard updates
- Payment page updates

### 🔄 Needs Integration
- Email service injection into controllers
- Student model injection for record creation
- User model injection for role updates
- Program model integration for code retrieval
- Actual email sending (currently logged)

### 📋 Next Steps
1. Inject required services into controllers
2. Test email template rendering
3. Implement proper student record creation
4. Add user role update functionality
5. Create admin UI for workflow management
6. Add CBT platform integration
7. Implement admission letter generation
8. Add bulk operation capabilities

## Configuration Required

### Environment Variables
```env
STUDENT_PORTAL_URL=http://localhost:3000/student-portal
FRONTEND_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
```

### Database Collections
- `applications` - Enhanced with new workflow fields
- `students` - New collection for matriculated students
- `payments` - Existing with new payment codes
- `student_payments` - Existing payment records

This implementation provides a comprehensive, automated workflow that guides students through the entire admission process while giving administrators full control over exam scheduling, screening, and admission decisions.