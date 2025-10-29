# Exam Status Management Implementation

## Overview
This implementation adds automatic exam status management based on question count and timing. The system now automatically transitions exam statuses through different phases.

## Status Flow

### 1. Draft → Scheduled
- **Trigger**: When question count reaches `exam.totalQuestions`
- **Condition**: `status === 'draft' && questionCount >= totalQuestions`
- **Action**: Updates status to `'scheduled'`

### 2. Scheduled → In Progress
- **Trigger**: When current time reaches `exam.examTimestamp`
- **Condition**: `status === 'scheduled' && now >= examStartTime && now <= examEndTime`
- **Action**: Updates status to `'in-progress'`

### 3. In Progress → Completed
- **Trigger**: When exam time window ends
- **Condition**: `status === 'in-progress' && now > examEndTime`
- **Action**: Updates status to `'completed'`

### 4. Scheduled → Draft (Rollback)
- **Trigger**: When question count drops below required total
- **Condition**: `status === 'scheduled' && questionCount < totalQuestions`
- **Action**: Updates status back to `'draft'`

## Implementation Details

### Automatic Triggers
1. **Question Creation/Deletion**: Calls `checkAndUpdateExamStatus(examId)` after each operation
2. **Bulk Import**: Calls status check after successful import
3. **API Calls**: `getAvailableExamsForCurrentTime()` updates statuses before returning results

### Manual Triggers
- **Endpoint**: `POST /api/v1/exams/update-statuses` (Admin/Staff only)
- **Purpose**: Manually update all exam statuses based on current time
- **Usage**: Can be called by cron jobs or scheduled tasks

### Key Methods

#### `checkAndUpdateExamStatus(examId: string)`
- Checks specific exam's question count and timing
- Updates status if conditions are met
- Called after question operations

#### `updateExamStatusesByTime()`
- Updates all exams based on current time
- Handles scheduled → in-progress transitions
- Handles in-progress → completed transitions

#### `getAvailableExamsForCurrentTime()`
- Updates statuses first, then returns available exams
- Ensures users see current exam states

## Time Calculations
- **Exam Start**: `exam.examTimestamp`
- **Exam End**: `examTimestamp + (duration * 60 * 1000)` (duration in minutes)
- **Current Time**: `new Date()`

## Targeting System
Exams become available to users based on:
- **Status**: Must be `'scheduled'` or `'in-progress'`
- **Target Type**: `'applicants'`, `'students'`, `'staff'`, or `'custom'`
- **Filter Conditions**: Programs, departments, roles, etc.
- **Timing**: Current time must be within exam window for `'in-progress'` exams

## CBT Portal Integration
The CBT portal should:
1. Call `GET /api/v1/exams/available` to get current user's exams
2. Show only `'in-progress'` exams as startable
3. Display `'scheduled'` exams with countdown timers
4. Enforce exam end time (`examTimestamp + duration`)

## Database Schema
The exam schema includes:
- `status`: `'draft' | 'scheduled' | 'in-progress' | 'completed' | 'graded'`
- `totalQuestions`: Required number of questions
- `examTimestamp`: When exam becomes available
- `duration`: Exam duration in minutes
- `target`: Who can access the exam

## Monitoring
All status changes are logged with:
- Exam ID
- Previous status → New status
- Reason for change
- Timestamp

## Future Enhancements
1. **Cron Jobs**: Install `@nestjs/schedule` for automatic periodic updates
2. **Notifications**: Alert users when exams become available
3. **Grace Periods**: Allow late submissions within a grace period
4. **Exam Extensions**: Admin ability to extend exam times