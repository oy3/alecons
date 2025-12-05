import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PaymentsService } from '../payments/payments.service';
import { PaymentAudience } from '../schemas/payment.schema';
import { Logger } from '@nestjs/common';

const logger = new Logger('SeedPayments');

async function seedPayments() {
    try {
        logger.log('Starting payment seeding...');

        const app = await NestFactory.createApplicationContext(AppModule);
        const paymentsService = app.get(PaymentsService);

        // Sample payments to create
        const samplePayments = [
            {
                name: 'Application Fee',
                description: 'Fee for submitting university application',
                amount: 25000,
                category: 'admission',
                isActive: true
            },
            {
                name: 'Tuition Fee - Semester 1',
                description: 'First semester tuition payment',
                amount: 350000,
                category: 'tuition',
                isActive: true
            },
            {
                name: 'Library Fee',
                description: 'Annual library access and maintenance fee',
                amount: 15000,
                category: 'facility',
                isActive: true
            },
            {
                name: 'Laboratory Fee',
                description: 'Laboratory equipment and usage fee',
                amount: 45000,
                category: 'facility',
                isActive: true
            },
            {
                name: 'Examination Fee',
                description: 'Fee for semester examinations',
                amount: 20000,
                category: 'examination',
                isActive: true
            },
            {
                name: 'Student ID Card Fee',
                description: 'Fee for student identification card',
                amount: 5000,
                category: 'miscellaneous',
                isActive: true
            },
            {
                name: 'Graduation Fee',
                description: 'Fee for graduation ceremony and certificate',
                amount: 75000,
                category: 'graduation',
                isActive: false
            },
            {
                name: 'Accommodation Fee',
                description: 'Annual hostel accommodation fee (₦100,000 + ₦5,000 general maintenance)',
                amount: 105000,
                category: 'accommodation',
                paymentCode: 'accommodationFee',
                isActive: true,
                targetAudience: [PaymentAudience.STUDENT]
            }
        ];

        for (const paymentData of samplePayments) {
            try {
                const payment = await paymentsService.createPayment(paymentData);
                logger.log(`Created payment: ${payment.name} (${payment.id})`);
            } catch (error) {
                if (error.code === 11000) {
                    logger.warn(`Payment "${paymentData.name}" already exists, skipping...`);
                } else {
                    logger.error(`Error creating payment "${paymentData.name}":`, error.message);
                }
            }
        }

        logger.log('Payment seeding completed successfully');
        await app.close();
    } catch (error) {
        logger.error('Error during payment seeding:', error);
        process.exit(1);
    }
}

seedPayments();