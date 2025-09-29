import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export class SpacesConfig {
    private static instance: S3Client;

    static getClient(configService: ConfigService): S3Client {
        if (!this.instance) {
            this.instance = new S3Client({
                endpoint: configService.get<string>('SPACES_ENDPOINT'),
                region: configService.get<string>('SPACES_REGION', 'us-east-1'),
                credentials: {
                    accessKeyId: configService.get<string>('SPACES_KEY'),
                    secretAccessKey: configService.get<string>('SPACES_SECRET'),
                },
                forcePathStyle: false, // Required for DigitalOcean Spaces
            });
        }
        return this.instance;
    }
}

export const SPACES_CONFIG = {
    BUCKET_NAME: 'SPACES_BUCKET_NAME',
    ALLOWED_FILE_TYPES: {
        PROFILE_PICTURE: ['.jpg', '.jpeg'],
        DOCUMENT: ['.pdf'],
    },
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB in bytes
    FILE_PATHS: {
        APPLICATIONS: 'applications',
        TEMP: 'temp',
    },
    // Temporary file cleanup settings
    TEMP_FILE_EXPIRY_HOURS: 24, // Files older than 24 hours in temp will be cleaned up
};