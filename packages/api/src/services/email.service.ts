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
                        
                        <p>Thank you for creating your account with Alebiosu College of Nursing Services (ALECONS)!</p>
                        
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
                            Email: admissions@alecons.edu.ng<br>
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
                            Email: admissions@alecons.edu.ng<br>
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

    async sendEntranceExamScheduledEmail(
        email: string,
        firstName: string,
        examDate: Date,
        examTime: string,
        examLink: string
    ): Promise<void> {
        const formattedDate = examDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Entrance Examination Scheduled - Alebiosu College of Nursing',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Entrance Exam Scheduled</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #2d7d7d; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .exam-details { background-color: #f8f9fa; border-left: 4px solid #2d7d7d; padding: 15px; margin: 20px 0; }
                        .important { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 Entrance Examination Scheduled</h1>
                        </div>
                        
                        <h2>Dear ${firstName},</h2>
                        
                        <p>Good news! Your online entrance examination has been scheduled.</p>
                        
                        <div class="exam-details">
                            <h3>📅 Examination Details:</h3>
                            <p><strong>Date:</strong> ${formattedDate}</p>
                            <p><strong>Time:</strong> ${examTime}</p>
                            <p><strong>Duration:</strong> 2 Hours</p>
                            <p><strong>Format:</strong> Computer-Based Test (CBT)</p>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${examLink}" class="btn">Access Exam Portal</a>
                        </div>
                        
                        <div class="important">
                            <h4>⚠️ Important Instructions:</h4>
                            <ul>
                                <li>Ensure stable internet connection</li>
                                <li>Use a computer or laptop (not mobile phone)</li>
                                <li>Login 15 minutes before the exam time</li>
                                <li>Have a valid ID ready for verification</li>
                                <li>Ensure your environment is quiet and well-lit</li>
                            </ul>
                        </div>
                        
                        <p>If you have any technical issues or questions, please contact our support team immediately.</p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Entrance exam scheduled email sent successfully to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send entrance exam email to ${email}:`, error);
            throw error;
        }
    }

    async sendScreeningScheduledEmail(
        email: string,
        firstName: string,
        screeningDate: Date,
        screeningTime: string,
        venue: string
    ): Promise<void> {
        const formattedDate = screeningDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Screening & Interview Scheduled - Alebiosu College of Nursing',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Screening Scheduled</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #2d7d7d; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .screening-details { background-color: #f8f9fa; border-left: 4px solid #2d7d7d; padding: 15px; margin: 20px 0; }
                        .documents { background-color: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📋 Screening & Interview Scheduled</h1>
                        </div>
                        
                        <h2>Dear ${firstName},</h2>
                        
                        <p>Congratulations on passing your entrance examination! Your physical screening and interview has been scheduled.</p>
                        
                        <div class="screening-details">
                            <h3>📅 Screening Details:</h3>
                            <p><strong>Date:</strong> ${formattedDate}</p>
                            <p><strong>Time:</strong> ${screeningTime}</p>
                            <p><strong>Venue:</strong> ${venue}</p>
                            <p><strong>Duration:</strong> Approximately 1-2 Hours</p>
                        </div>
                        
                        <div class="documents">
                            <h4>📄 Required Documents (Original & Photocopies):</h4>
                            <ul>
                                <li>O'Level Certificates (WAEC/NECO/GCE)</li>
                                <li>Birth Certificate or Age Declaration</li>
                                <li>State of Origin Certificate</li>
                                <li>Passport Photographs (2 copies)</li>
                                <li>Medical Certificate of Fitness</li>
                                <li>Character Reference Letters</li>
                                <li>Any other certificates/qualifications</li>
                            </ul>
                        </div>
                        
                        <h4>What to Expect:</h4>
                        <ul>
                            <li>Document verification</li>
                            <li>Personal interview</li>
                            <li>Medical fitness assessment</li>
                            <li>Background verification</li>
                        </ul>
                        
                        <p><strong>Please arrive 30 minutes early.</strong> Late arrivals may not be accommodated.</p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Screening scheduled email sent successfully to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send screening email to ${email}:`, error);
            throw error;
        }
    }

    async sendAdmissionLetterEmail(email: string, firstName: string, admissionLetterUrl: string): Promise<void> {
        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: '🎉 Admission Offer - Alebiosu College of Nursing',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Admission Offer</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #28a745; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .celebration { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
                        .next-steps { background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎉 CONGRATULATIONS! 🎉</h1>
                            <h2>You've been admitted!</h2>
                        </div>
                        
                        <div class="celebration">
                            <h2>Dear ${firstName},</h2>
                            <p><strong>We are delighted to offer you admission to Alebiosu College of Nursing!</strong></p>
                        </div>
                        
                        <p>After careful review of your application, we are pleased to inform you that you have been selected to join our prestigious nursing program.</p>
                        
                        <div style="text-align: center;">
                            <a href="${admissionLetterUrl}" class="btn">Download Admission Letter</a>
                        </div>
                        
                        <div class="next-steps">
                            <h3>📋 Next Steps:</h3>
                            <ol>
                                <li><strong>Download and read your admission letter</strong></li>
                                <li><strong>Pay Acceptance Fee</strong> - Confirm your acceptance</li>
                                <li><strong>Pay Sundry Fees</strong> - Administrative charges</li>
                                <li><strong>Pay School Fees</strong> - Tuition and other fees</li>
                                <li><strong>Complete Registration</strong> - Finalize your enrollment</li>
                            </ol>
                        </div>
                        
                        <p><strong>Important:</strong> You have 14 days to accept this offer by paying the acceptance fee. Failure to do so may result in the offer being withdrawn.</p>
                        
                        <p>Welcome to the ALECONS family! We look forward to supporting you on your journey to becoming a professional nurse.</p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Admission letter email sent successfully to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send admission letter email to ${email}:`, error);
            throw error;
        }
    }

    async sendRejectionEmail(email: string, firstName: string, reason?: string): Promise<void> {
        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Application Update - Alebiosu College of Nursing',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Application Update</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #2d7d7d; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .message { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .encouragement { background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Application Update</h1>
                        </div>
                        
                        <h2>Dear ${firstName},</h2>
                        
                        <p>Thank you for your interest in Alebiosu College of Nursing and for taking the time to complete your application.</p>
                        
                        <div class="message">
                            <p>After careful consideration of all applications, we regret to inform you that we are unable to offer you admission at this time.</p>
                        </div>
                        
                        ${reason ? `<p><strong>Feedback:</strong> ${reason}</p>` : ''}
                        
                        <div class="encouragement">
                            <h4>We encourage you to:</h4>
                            <ul>
                                <li>Consider reapplying in future admission cycles</li>
                                <li>Explore our other programs that might interest you</li>
                                <li>Continue pursuing your educational goals</li>
                            </ul>
                        </div>
                        
                        <p>We appreciate your interest in our institution and wish you success in your future endeavors.</p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Rejection email sent successfully to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send rejection email to ${email}:`, error);
            throw error;
        }
    }

    async sendMatriculationEmail(
        email: string,
        firstName: string,
        matricNumber: string,
        studentPortalUrl: string
    ): Promise<void> {
        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: '🎓 Welcome to ALECONS - Your Matriculation Details',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Matriculation Details</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #2d7d7d; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .matric-details { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
                        .login-details { background-color: #f8f9fa; border-left: 4px solid #2d7d7d; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 Welcome to ALECONS!</h1>
                            <h2>Application Process Complete</h2>
                        </div>
                        
                        <h2>Dear ${firstName},</h2>
                        
                        <p>Congratulations! You have successfully completed all admission requirements. Welcome to the Alebiosu College of Nursing family!</p>
                        
                        <div class="matric-details">
                            <h3>📝 Your Matriculation Details</h3>
                            <p><strong>Matriculation Number:</strong></p>
                            <h2 style="color: #2d7d7d; margin: 10px 0;">${matricNumber}</h2>
                            <p><em>Please keep this number safe - you'll need it throughout your studies.</em></p>
                        </div>
                        
                        <div class="login-details">
                            <h3>🔐 Student Portal Access</h3>
                            <p>You can now access the student portal using either:</p>
                            <ul>
                                <li><strong>Email:</strong> ${email}</li>
                                <li><strong>Matriculation Number:</strong> ${matricNumber}</li>
                            </ul>
                            <p><strong>Password:</strong> Your current account password</p>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${studentPortalUrl}" class="btn">Access Student Portal</a>
                        </div>
                        
                        <h3>What's Next?</h3>
                        <ul>
                            <li>Access your student portal for course information</li>
                            <li>Check your academic calendar and timetable</li>
                            <li>Connect with your student advisors</li>
                            <li>Join student orientation programs</li>
                        </ul>
                        
                        <p>We're excited to have you join our community of future healthcare professionals!</p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Matriculation email sent successfully to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send matriculation email to ${email}:`, error);
            throw error;
        }
    }

    /**
     * Send exam scheduled notification to target audience
     */
    async sendExamScheduledEmail(
        email: string,
        firstName: string,
        examTitle: string,
        examDate: Date,
        examDuration: number,
        targetType: string
    ): Promise<void> {
        const examDateTime = examDate.toLocaleDateString('en-NG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Lagos'
        });

        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Exam Scheduled: ${examTitle} - Alebiosu College of Nursing`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Exam Scheduled</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #2d7d7d; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .exam-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📋 Exam Scheduled</h1>
                        </div>
                        
                        <h2>Hello ${firstName},</h2>
                        
                        <p>An exam has been scheduled for ${targetType}. Please find the details below:</p>
                        
                        <div class="exam-details">
                            <h3><strong>${examTitle}</strong></h3>
                            <p><strong>📅 Date & Time:</strong> ${examDateTime}</p>
                            <p><strong>⏱️ Duration:</strong> ${examDuration} minutes</p>
                            <p><strong>👥 Target Audience:</strong> ${targetType.charAt(0).toUpperCase() + targetType.slice(1)}</p>
                        </div>

                        <div class="alert">
                            <p><strong>⚠️ Important Notes:</strong></p>
                            <ul>
                                <li>You will receive the exam password separately via email</li>
                                <li>Ensure you have a stable internet connection</li>
                                <li>Login to your portal 15 minutes before the exam time</li>
                                <li>You'll receive a reminder 30 minutes before the exam</li>
                            </ul>
                        </div>

                        <div style="text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Access Portal</a>
                        </div>
                        
                        <p>If you have any questions about this exam, please contact the administration office.</p>
                        
                        <div class="footer">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Exam scheduled email sent successfully to ${email} for exam: ${examTitle}`);
        } catch (error) {
            this.logger.error(`Failed to send exam scheduled email to ${email}:`, error);
            throw error;
        }
    }

    /**
     * Send exam password notification
     */
    async sendExamPasswordEmail(
        email: string,
        firstName: string,
        examTitle: string,
        examPassword: string,
        examDate: Date,
        isRegenerated: boolean = false
    ): Promise<void> {
        const examDateTime = examDate.toLocaleDateString('en-NG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Lagos'
        });

        const subject = isRegenerated ?
            `New Exam Password: ${examTitle} - Alebiosu College of Nursing` :
            `Exam Password: ${examTitle} - Alebiosu College of Nursing`;

        const headerText = isRegenerated ? '🔄 Exam Password Regenerated' : '🔐 Exam Password';
        const messageText = isRegenerated ?
            'A new password has been generated for your exam. Please use this new password:' :
            'Here is your password for the upcoming exam:';

        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Exam Password</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #2d7d7d; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .password-box { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
                        .password { font-size: 24px; font-weight: bold; color: #856404; letter-spacing: 3px; }
                        .exam-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .alert { background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${headerText}</h1>
                        </div>
                        
                        <h2>Hello ${firstName},</h2>
                        
                        <p>${messageText}</p>
                        
                        <div class="password-box">
                            <p><strong>Your Exam Password:</strong></p>
                            <div class="password">${examPassword}</div>
                        </div>

                        <div class="exam-details">
                            <h3><strong>${examTitle}</strong></h3>
                            <p><strong>📅 Exam Date & Time:</strong> ${examDateTime}</p>
                        </div>

                        <div class="alert">
                            <p><strong>🔒 Security Instructions:</strong></p>
                            <ul>
                                <li><strong>Keep this password confidential</strong> - do not share with anyone</li>
                                <li>You will need this password to start your exam</li>
                                <li>Copy this password or write it down safely</li>
                                <li>${isRegenerated ? 'Any previous passwords are now invalid' : 'This password is only valid for this exam'}</li>
                            </ul>
                        </div>

                        <div style="text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Access Portal</a>
                        </div>
                        
                        <p>If you have any issues accessing your exam, please contact the administration office immediately.</p>
                        
                        <div class="footer">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Exam password email sent successfully to ${email} for exam: ${examTitle}`);
        } catch (error) {
            this.logger.error(`Failed to send exam password email to ${email}:`, error);
            throw error;
        }
    }

    /**
     * Send 30-minute reminder before exam
     */
    async sendExamReminderEmail(
        email: string,
        firstName: string,
        examTitle: string,
        examDate: Date
    ): Promise<void> {
        const examDateTime = examDate.toLocaleDateString('en-NG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Lagos'
        });

        const mailOptions = {
            from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `⏰ Exam Reminder: ${examTitle} starts in 30 minutes`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Exam Reminder</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #dc3545; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .urgent { background-color: #f8d7da; border: 2px solid #dc3545; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
                        .exam-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .checklist { background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>⏰ Exam Reminder</h1>
                        </div>
                        
                        <div class="urgent">
                            <h2>🚨 Your exam starts in 30 minutes!</h2>
                        </div>
                        
                        <h2>Hello ${firstName},</h2>
                        
                        <p>This is a friendly reminder that your exam is starting soon. Please prepare now!</p>
                        
                        <div class="exam-details">
                            <h3><strong>${examTitle}</strong></h3>
                            <p><strong>📅 Start Time:</strong> ${examDateTime}</p>
                        </div>

                        <div class="checklist">
                            <p><strong>✅ Pre-Exam Checklist:</strong></p>
                            <ul>
                                <li>Have your exam password ready</li>
                                <li>Ensure stable internet connection</li>
                                <li>Close unnecessary browser tabs and applications</li>
                                <li>Find a quiet, distraction-free environment</li>
                                <li>Have backup power source if possible</li>
                                <li>Login to your portal now to avoid last-minute issues</li>
                            </ul>
                        </div>

                        <div style="text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Login Now</a>
                        </div>
                        
                        <p><strong>Good luck with your exam!</strong> 🍀</p>
                        
                        <div class="footer">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Exam reminder email sent successfully to ${email} for exam: ${examTitle}`);
        } catch (error) {
            this.logger.error(`Failed to send exam reminder email to ${email}:`, error);
            throw error;
        }
    }

    /**
     * Send exam completion confirmation
     */
    async sendExamCompletionEmail(
        email: string,
        firstName: string,
        examTitle: string,
        submissionTime: Date,
        score?: number,
        totalMarks?: number,
        isAutoSubmitted?: boolean
    ): Promise<void> {
        const submissionDateTime = submissionTime.toLocaleDateString('en-NG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Africa/Lagos'
        });

        const showScore = score !== undefined && totalMarks !== undefined;
        const percentage = showScore ? ((score / totalMarks) * 100).toFixed(1) : null;

        const mailOptions = {
            from: `"Alebiosu College of Nursing Sciences" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `✅ Exam Completed: ${examTitle} - Alebiosu College of Nursing`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Exam Completed</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; margin-top: 20px; }
                        .header { background-color: #28a745; color: white; text-align: center; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
                        .success { background-color: #d4edda; border: 2px solid #28a745; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
                        .exam-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .score-box { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
                        .info { background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .btn { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✅ Exam ${isAutoSubmitted ? 'Auto-Submitted' : 'Successfully Completed'}!</h1>
                        </div>
                        
                        <div class="success">
                            <h2>🎉 ${isAutoSubmitted ? 'Time\'s Up!' : 'Congratulations'} ${firstName}!</h2>
                            <p>${isAutoSubmitted
                    ? 'Your exam time has expired and has been automatically submitted for grading.'
                    : 'You have successfully completed your exam.'}</p>
                        </div>
                        
                        <div class="exam-details">
                            <h3><strong>${examTitle}</strong></h3>
                            <p><strong>📅 ${isAutoSubmitted ? 'Auto-Submitted On:' : 'Submitted On:'}</strong> ${submissionDateTime}</p>
                            ${isAutoSubmitted ? '<p><strong>⏰ Reason:</strong> Exam time limit reached</p>' : ''}
                        </div>

                        ${showScore ? `
                        <div class="score-box">
                            <h3>📊 Your Score</h3>
                            <p style="font-size: 20px; font-weight: bold; color: #856404;">
                                ${score} out of ${totalMarks} (${percentage}%)
                            </p>
                        </div>
                        ` : ''}

                        <div class="info">
                            <p><strong>📋 What's Next?</strong></p>
                            <ul>
                                ${isAutoSubmitted ? '<li>Don\'t worry - all your answered questions have been saved</li>' : ''}
                                <li>${showScore ? 'Your results have been automatically graded' : 'Your exam is being reviewed and graded'}</li>
                                <li>You will be notified once final results are published</li>
                                <li>Check your dashboard regularly for updates</li>
                                <li>Keep this email as confirmation of your submission</li>
                                ${isAutoSubmitted ? '<li>If you have any concerns, please contact our support team</li>' : ''}
                            </ul>
                        </div>

                        <div style="text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">View Dashboard</a>
                        </div>
                        
                        <p>${isAutoSubmitted
                    ? 'Thank you for your participation. Even though time ran out, your answers have been safely submitted for grading.'
                    : 'Thank you for taking the exam. We wish you the best of luck with your results!'}</p>
                        
                        <div class="footer">
                            <p><strong>Alebiosu College of Nursing Services</strong><br>
                            Omuo Oke, Ekiti State, Nigeria<br>
                            Email: admissions@alecons.edu.ng<br>
                            Phone: +234 708 460 1610</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Exam completion email sent successfully to ${email} for exam: ${examTitle}`);
        } catch (error) {
            this.logger.error(`Failed to send exam completion email to ${email}:`, error);
            throw error;
        }
    }

    /**
     * Send bulk emails with rate limiting
     */
    async sendBulkEmails(
        emails: string[],
        emailFunction: (email: string, ...args: any[]) => Promise<void>,
        ...args: any[]
    ): Promise<{ successful: number; failed: string[] }> {
        const successful = 0;
        const failed: string[] = [];
        const batchSize = 10; // Send in batches to avoid overwhelming the SMTP server
        const delay = 1000; // 1 second delay between batches

        this.logger.log(`Starting bulk email send to ${emails.length} recipients`);

        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            const batchPromises = batch.map(async (email) => {
                try {
                    await emailFunction.call(this, email, ...args);
                    return { email, success: true };
                } catch (error) {
                    this.logger.error(`Failed to send email to ${email}:`, error.message);
                    return { email, success: false };
                }
            });

            const results = await Promise.allSettled(batchPromises);
            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        (successful as any)++;
                    } else {
                        failed.push(result.value.email);
                    }
                } else {
                    // This shouldn't happen with our current setup, but handle it anyway
                    this.logger.error('Unexpected promise rejection:', result.reason);
                }
            });

            // Add delay between batches (except for the last batch)
            if (i + batchSize < emails.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        this.logger.log(`Bulk email send completed: ${successful} successful, ${failed.length} failed`);
        return { successful, failed };
    }

    /**
     * Send exam result notification email to student
     */
    async sendExamResultEmail(
        email: string,
        firstName: string,
        examTitle: string,
        score: number,
        totalQuestions: number,
        percentage: number,
        status: string,
        gradedAt: Date
    ): Promise<void> {
        try {
            const subject = `📊 Exam Results Released - ${examTitle}`;
            const statusColor = status === 'pass' ? '#28a745' : '#dc3545';
            const statusText = status === 'pass' ? 'PASSED' : 'FAILED';
            const resultMessage = status === 'pass'
                ? 'Congratulations! You have successfully passed this exam.'
                : 'Unfortunately, you did not meet the passing requirements for this exam.';

            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Exam Results Released</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">ALECONS</h1>
                        <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Alebiosu College of Nursing Sciences</p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">📊 Your Exam Results Are Ready!</h2>
                        
                        <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
                            Dear ${firstName},
                        </p>
                        
                        <p style="color: #666666; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">
                            We're excited to inform you that your exam results for <strong>${examTitle}</strong> are now available.
                        </p>

                        <!-- Result Card -->
                        <div style="background-color: #f8f9fa; border-radius: 10px; padding: 25px; margin: 30px 0; border-left: 5px solid ${statusColor};">
                            <h3 style="color: #333333; margin: 0 0 20px 0; font-size: 20px;">Your Results</h3>
                            
                            <div style="margin-bottom: 15px;">
                                <span style="color: #666666; font-size: 14px; display: inline-block; width: 120px;">Exam:</span>
                                <span style="color: #333333; font-weight: bold; font-size: 16px;">${examTitle}</span>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <span style="color: #666666; font-size: 14px; display: inline-block; width: 120px;">Score:</span>
                                <span style="color: #333333; font-weight: bold; font-size: 18px;">${score}/${totalQuestions} (${percentage}%)</span>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <span style="color: #666666; font-size: 14px; display: inline-block; width: 120px;">Status:</span>
                                <span style="
                                    background-color: ${statusColor}; 
                                    color: white; 
                                    padding: 6px 12px; 
                                    border-radius: 6px; 
                                    font-weight: bold; 
                                    font-size: 14px;
                                    display: inline-block;
                                ">${statusText}</span>
                            </div>
                            
                            <div style="margin-bottom: 0;">
                                <span style="color: #666666; font-size: 14px; display: inline-block; width: 120px;">Released:</span>
                                <span style="color: #666666; font-size: 14px;">${gradedAt.toLocaleString()}</span>
                            </div>
                        </div>

                        <div style="background-color: #e3f2fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
                            <p style="color: #1976d2; margin: 0; font-size: 16px; font-weight: 500;">
                                ${resultMessage}
                            </p>
                        </div>

                        <!-- Next Steps -->
                        <div style="margin: 30px 0;">
                            <h4 style="color: #333333; margin: 0 0 15px 0; font-size: 18px;">What's Next?</h4>
                            <ul style="color: #666666; line-height: 1.6; padding-left: 20px; margin: 0;">
                                ${status === 'pass'
                    ? `<li>Continue to the next phase of your academic journey</li>
                                       <li>Check your student portal for any additional requirements</li>
                                       <li>Contact the academic office if you have any questions</li>`
                    : `<li>Review the exam material for areas of improvement</li>
                                       <li>Contact your instructor for additional guidance</li>
                                       <li>Check if retake opportunities are available</li>`
                }
                            </ul>
                        </div>

                        <p style="color: #666666; line-height: 1.6; margin: 30px 0 0 0; font-size: 16px;">
                            If you have any questions about your results, please don't hesitate to contact our academic support team.
                        </p>
                        
                        <p style="color: #666666; line-height: 1.6; margin: 20px 0 0 0; font-size: 16px;">
                            Best regards,<br>
                            <strong>The ALECONS Academic Team</strong>
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="background-color: #333333; padding: 20px; text-align: center;">
                        <p style="color: #ffffff; margin: 0; font-size: 14px; opacity: 0.8;">
                            This is an automated message from ALECONS Examination System.
                        </p>
                        <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 12px; opacity: 0.6;">
                            © ${new Date().getFullYear()} Alebiosu College of Nursing Sciences. All rights reserved.
                        </p>
                    </div>
                </div>
            </body>
            </html>
            `;

            await this.transporter.sendMail({
                from: `"Alebiosu College of Nursing" <${process.env.SMTP_USER}>`,
                to: email,
                subject,
                html,
            });

            this.logger.log(`Exam result email sent successfully to ${email} for exam: ${examTitle}`);

        } catch (error) {
            this.logger.error(`Failed to send exam result email to ${email}:`, error.message);
            throw error;
        }
    }
}