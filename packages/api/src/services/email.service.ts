import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter;

    constructor() {
        this.logger.log('Email service initialization:', {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            hasPassword: !!process.env.SMTP_PASS,
            hasClientId: !!process.env.GOOGLE_CLIENT_ID,
            hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
            hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN
        });

        // Use OAuth2 if credentials are available, otherwise fall back to App Password
        const useOAuth2 = process.env.GOOGLE_CLIENT_ID &&
            process.env.GOOGLE_CLIENT_SECRET &&
            process.env.GOOGLE_REFRESH_TOKEN;

        if (useOAuth2) {
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: process.env.SMTP_USER,
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
                },
            });
        } else {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }

        // Test the connection
        this.testConnection();
    }

    private async testConnection(): Promise<void> {
        try {
            await this.transporter.verify();
            this.logger.log('SMTP connection verified successfully');
        } catch (error) {
            this.logger.error('SMTP connection failed:', error.message);
        }
    }

    async sendVerificationEmail(email: string, firstName: string, verificationToken: string): Promise<void> {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Verify Your Email Address - Alebiosu College of Nursing',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Verification</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #2d7d7d; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .btn:hover { background-color: #d16849; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome to Alebiosu College of Nursing</h1>
                        </div>
                        
                        <h2>Hello ${firstName},</h2>
                        
                        <p>Thank you for creating your account with Alebiosu College of Nursing Services (ACON)!</p>
                        
                        <p>To complete your registration and proceed with your application, please verify your email address by clicking the button below:</p>
                        
                        <div style="text-align: center;">
                            <a href="${verificationUrl}" class="btn">Verify Email Address</a>
                        </div>
                        
                        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">
                            ${verificationUrl}
                        </p>
                        
                        <p><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
                        
                        <p>Once your email is verified, you'll be able to:</p>
                        <ul>
                            <li>Pay your application form fee</li>
                            <li>Complete your application form</li>
                            <li>Track your admission status</li>
                        </ul>
                        
                        <p>If you didn't create this account, please ignore this email.</p>
                        
                        <div class="footer">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@acon.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Verification email sent successfully to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send verification email to ${email}:`, error);
            throw error;
        }
    }

    async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Email Verified Successfully - Alebiosu College of Nursing',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Verified</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #2d7d7d; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✅ Email Verified Successfully!</h1>
                        </div>
                        
                        <div class="success">
                            <strong>Congratulations ${firstName}!</strong> Your email address has been verified successfully.
                        </div>
                        
                        <p>You can now proceed with your application process:</p>
                        
                        <h3>Next Steps:</h3>
                        <ol>
                            <li><strong>Pay Application Form Fee</strong> - Complete payment to unlock the application form</li>
                            <li><strong>Fill Application Form</strong> - Provide your academic and personal information</li>
                            <li><strong>Upload Documents</strong> - Submit required documents</li>
                            <li><strong>Track Status</strong> - Monitor your admission progress</li>
                        </ol>
                        
                        <div style="text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Go to Dashboard</a>
                        </div>
                        
                        <p>If you have any questions or need assistance, please contact our admissions office.</p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@acon.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Welcome email sent successfully to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send welcome email to ${email}:`, error);
            throw error;
        }
    }
}