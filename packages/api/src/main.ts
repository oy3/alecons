import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Enable CORS
    app.enableCors({
        origin: [
            process.env.FRONTEND_URL || 'http://localhost:5173',
            'http://localhost:5174', // CBT Portal (original)
            'http://localhost:3004', // CBT Portal (current)
            'http://localhost:3001', // Staff portal
            'http://localhost:3002', // Student portal (future)
            'http://localhost:3003', // Website (future)
        ],
        credentials: true,
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
}

bootstrap();
