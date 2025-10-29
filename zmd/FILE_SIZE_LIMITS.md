# File Upload Size Limits

## Updated File Size Restrictions

To improve performance and manage storage efficiently, we have updated the file upload size limits:

### Previous Limits (All files)
- **All file types**: 5MB maximum

### New Limits (Specific per file type)
- **Profile Pictures** (JPG/JPEG): **2MB maximum**
- **PDF Documents** (O'Level results, Reference letters): **3MB maximum**

## Why These Changes?

### Profile Pictures (2MB)
- **Sufficient Quality**: 2MB is more than enough for high-quality passport photos
- **Faster Uploads**: Smaller files upload faster, improving user experience
- **Storage Efficiency**: Reduces unnecessary storage costs
- **Reasonable Size**: Most modern photos can be compressed to under 2MB without quality loss

### PDF Documents (3MB)
- **Document Clarity**: 3MB allows for clear, high-resolution scanned documents
- **Practical Limit**: Most PDF documents (result sheets, letters) are well under 3MB
- **Prevents Abuse**: Prevents users from uploading overly large files
- **Balanced Approach**: Maintains quality while controlling file sizes

## Implementation Details

### Backend Changes
- Updated `SPACES_CONFIG` in `/packages/api/src/config/spaces.config.ts`
- Modified file validation in `/packages/api/src/services/upload.service.ts`
- Specific error messages for each file type with their respective limits

### Frontend Changes
- Updated file size validation in `/apps/application-portal/src/views/application_form/application_form.vue`
- Dynamic error messages showing specific limits for different file types
- Updated UI text to reflect new limits

### Error Messages
Users now receive specific error messages:
- Profile pictures: "File size exceeds 2MB limit for profile picture"
- PDF documents: "File size exceeds 3MB limit for olevel result/reference letter"

## Benefits

1. **Better User Experience**: Faster uploads and clearer expectations
2. **Cost Optimization**: Reduced storage costs and bandwidth usage
3. **System Performance**: Improved server performance with smaller files
4. **Quality Control**: Encourages users to optimize their files appropriately

## Technical Implementation

```typescript
// New configuration
MAX_FILE_SIZE: {
  PROFILE_PICTURE: 2 * 1024 * 1024, // 2MB
  DOCUMENT: 3 * 1024 * 1024,        // 3MB
}
```

The system now validates each file type against its specific limit and provides meaningful error messages to guide users in preparing appropriately sized files.