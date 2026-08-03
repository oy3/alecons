import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHealth(): string {
        return 'Alecons API is running!';
    }

    getHealthCheck() {
        return {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
            version: '1.0.0',
        };
    }
}
