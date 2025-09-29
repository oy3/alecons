# DigitalOcean Spaces File Upload Setup Guide

This guide will help you set up DigitalOcean Spaces for file uploads in your application.

## Prerequisites

- DigitalOcean Account
- Access to your DigitalOcean Control Panel

## Step 1: Create a DigitalOcean Space

1. Log in to your DigitalOcean Control Panel
2. Navigate to **Spaces** in the left sidebar
3. Click **Create a Space**
4. Choose your settings:
   - **Region**: Choose closest to your users (e.g., NYC3, SFO3, AMS3)
   - **Space Name**: Choose a unique name (e.g., `alecons-application-files`)
   - **File Listing**: Choose "Public" for easier access (recommended)
5. Click **Create a Space**

## Step 2: Generate API Keys

1. In the DigitalOcean Control Panel, go to **API** → **Spaces access keys**
2. Click **Generate New Key**
3. Enter a name for your key (e.g., "Alecons Application Portal")
4. Click **Generate Access Key**
5. **IMPORTANT**: Save both the **Access Key** and **Secret Key** immediately - you won't be able to see the secret again!

## Step 3: Configure Environment Variables

Add these variables to your `/packages/api/.env` file:

```bash
# DigitalOcean Spaces Configuration
SPACES_KEY=your_access_key_here
SPACES_SECRET=your_secret_key_here
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_REGION=us-east-1
SPACES_BUCKET_NAME=your-bucket-name-here

# Optional: CDN URL if you set up a CDN
SPACES_CDN_URL=https://your-bucket-name.nyc3.cdn.digitaloceanspaces.com
```

### Configuration Notes:

- **SPACES_ENDPOINT**: Replace `nyc3` with your chosen region:
  - NYC3: `https://nyc3.digitaloceanspaces.com`
  - SFO3: `https://sfo3.digitaloceanspaces.com`
  - AMS3: `https://ams3.digitaloceanspaces.com`
  - SGP1: `https://sgp1.digitaloceanspaces.com`
  - FRA1: `https://fra1.digitaloceanspaces.com`

- **SPACES_REGION**: Keep as `us-east-1` (this is for S3 compatibility)

- **SPACES_BUCKET_NAME**: Use the exact name you chose when creating your Space

## Step 4: Optional - Set up CDN (Recommended for Production)

1. In your Space settings, go to the **Settings** tab
2. Enable **CDN**
3. Choose a custom subdomain or use the default
4. Update `SPACES_CDN_URL` in your environment variables

## Step 5: Test Your Configuration

1. Restart your API server
2. Try uploading a file through the application
3. Check your Space in the DigitalOcean Control Panel to see if files are being uploaded

## File Structure

Files will be organized in your Space as follows:

```
your-space-name/
└── applications/
    ├── {applicationId1}/
    │   ├── profile_picture_timestamp_uuid.jpg
    │   ├── olevel_result_timestamp_uuid.pdf
    │   └── reference_letter_timestamp_uuid.pdf
    └── {applicationId2}/
        ├── profile_picture_timestamp_uuid.jpg
        └── ...
```

## Security Considerations

1. **API Keys**: Keep your API keys secure and never commit them to version control
2. **File Access**: Files are uploaded with public-read permissions for easy access
3. **File Validation**: The system validates file types and sizes before upload
4. **CORS**: Make sure your frontend domain is configured in your API's CORS settings

## Troubleshooting

### Common Issues:

1. **"Invalid credentials"**: Check your API keys are correct and active
2. **"Bucket not found"**: Verify your Space name and region
3. **"CORS error"**: Ensure your frontend domain is allowed in API CORS settings
4. **"File too large"**: Current limit is 5MB per file

### Testing Upload Functionality:

You can test file uploads using curl:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/test/file.jpg" \
  -F "fileType=profile_picture" \
  http://localhost:8000/applications/upload
```

## File Upload Limits

- **Profile Pictures**: JPG/JPEG only, max 5MB
- **Documents** (O'level results, reference letters): PDF only, max 5MB
- **Total uploads**: No limit on number of files per application

## Cost Estimation

DigitalOcean Spaces pricing (as of 2024):
- **Storage**: $5/month for 250GB
- **Data Transfer**: $10/TB for outbound transfer
- **API Requests**: No charge for most operations

For a typical application with ~100 students/month uploading ~5 files each at ~2MB average:
- Storage needed: ~1GB/month
- Very cost-effective for most educational institutions

## Support

If you encounter issues:
1. Check the application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test API connectivity using the DigitalOcean API documentation
4. Contact DigitalOcean support for Space-specific issues