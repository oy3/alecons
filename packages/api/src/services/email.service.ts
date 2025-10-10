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
}