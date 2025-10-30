import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Enable CORS
    const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.APPLICATION_PORTAL_URL,
        process.env.CBT_PORTAL_URL,
        process.env.STAFF_PORTAL_URL,
        process.env.STUDENT_PORTAL_URL,
        process.env.WEBSITE_URL,
        // Development origins
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
    ].filter(Boolean); // Remove undefined values

    logger.log(`🌐 CORS enabled for origins: ${allowedOrigins.join(', ')}`);

    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
        exposedHeaders: ['Authorization'],
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );

    // API prefix
    app.setGlobalPrefix('api/v1');

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('Alecons API')
        .setDescription('Alecons Application Portal API Documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 8000;
    await app.listen(port);

    logger.log(`🚀 Alecons API running on http://localhost:${port}`);
    logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
    logger.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'No DATABASE_URL set'}`);

    // Log environment variables for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
        logger.log('🐛 Environment variables loaded:');
        logger.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL}`);
        logger.log(`   APPLICATION_PORTAL_URL: ${process.env.APPLICATION_PORTAL_URL}`);
        logger.log(`   CBT_PORTAL_URL: ${process.env.CBT_PORTAL_URL}`);
        logger.log(`   STAFF_PORTAL_URL: ${process.env.STAFF_PORTAL_URL}`);
        logger.log(`   STUDENT_PORTAL_URL: ${process.env.STUDENT_PORTAL_URL}`);
        logger.log(`   WEBSITE_URL: ${process.env.WEBSITE_URL}`);
    }
}

bootstrap();
