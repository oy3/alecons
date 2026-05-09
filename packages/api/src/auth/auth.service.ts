import { Injectable, ConflictException, UnauthorizedException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Application, ApplicationDocument } from '../schemas/application.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeDocument } from '../schemas/program-mode.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { EmailService } from '../services/email.service';
import { ApplicationNumberService } from '../services/application-number.service';
import { ApplicationEligibilityService } from '../services/application-eligibility.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { StudentService } from '../services/student.service';
import { SessionControlsService } from '../services/session-controls.service';
import { getNestedProgramRelation, resolveProgramSelection } from '../utils/program-relation.util';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly maxApplicationNumberRetries = 3;

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(ProgramType.name) private programTypeModel: Model<ProgramTypeDocument>,
        @InjectModel(ProgramMode.name) private programModeModel: Model<ProgramModeDocument>,
        @InjectModel(Staff.name) private staffModel: Model<StaffDocument>,
        @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
        private jwtService: JwtService,
        private emailService: EmailService,
        private applicationNumberService: ApplicationNumberService,
        private applicationEligibilityService: ApplicationEligibilityService,
        private studentService: StudentService,
        private sessionControlsService: SessionControlsService,
    ) { }

    private async mapApplicationResponse(application: ApplicationDocument) {
        const { currentStage, admissionFlow } = await this.sessionControlsService.syncApplicationStageWithControls(application);
        const applicationTimestamps = application as ApplicationDocument & {
            createdAt?: Date;
            updatedAt?: Date;
        };

        return {
            id: application._id,
            applicationNumber: application.applicationNumber,
            currentStage,
            status: application.status,
            admissionDecision: application.admissionDecision,
            program: getNestedProgramRelation(application).program,
            programType: getNestedProgramRelation(application).programType,
            programMode: getNestedProgramRelation(application).programMode,
            dob: application.dob,
            gender: application.gender,
            religion: application.religion,
            maritalStatus: application.maritalStatus,
            address: application.address,
            nationality: application.nationality,
            stateOfOrigin: application.stateOfOrigin,
            lga: application.lga,
            profileImageUrl: application.profileImageUrl,
            nextOfKin: application.nextOfKin,
            referees: application.referees,
            academicBackground: application.academicBackground,
            examinations: application.examinations,
            isJambExempt: application.isJambExempt,
            jambRegistrationNumber: application.jambRegistrationNumber,
            jambScore: application.jambScore,
            documents: application.documents,
            entranceExam: application.entranceExam,
            screening: application.screening,
            admissionFlow,
            createdAt: applicationTimestamps.createdAt,
            updatedAt: applicationTimestamps.updatedAt,
        };
    }

    private buildApplicantUser(data: {
        email: string;
        password: string;
        firstName: string;
        otherName?: string;
        lastName: string;
        phone?: string;
        verificationToken: string;
        tokenExpires: Date;
    }) {
        return new this.userModel({
            email: data.email,
            passwordHash: data.password,
            firstName: data.firstName,
            otherName: data.otherName,
            lastName: data.lastName,
            phone: data.phone,
            role: UserRole.APPLICANT,
            isEmailVerified: false,
            emailVerificationToken: data.verificationToken,
            emailVerificationTokenExpires: data.tokenExpires,
        });
    }

    private async createApplicantApplication(data: {
        userId: Types.ObjectId;
        programId: string;
        activeSessionId: Types.ObjectId;
        dateOfBirth?: string;
        gender?: string;
        applicationNumber: string;
    }) {
        const applicationData: any = {
            userId: data.userId,
            applicationNumber: data.applicationNumber,
            programId: new Types.ObjectId(data.programId),
            entryAcademicSession: data.activeSessionId,
            status: 'pending',
            currentStage: 1,
            referees: [],
            examinations: [],
            documents: {
                olevelResults: [],
                referenceLetters: []
            },
        };

        if (data.dateOfBirth) applicationData.dob = new Date(data.dateOfBirth);
        if (data.gender) applicationData.gender = data.gender;

        return new this.applicationModel(applicationData);
    }

    private isTransactionUnsupportedError(error: any): boolean {
        const errorMessage = error?.message || error?.errorResponse?.errmsg || '';
        return error?.code === 20 || /Transaction numbers are only allowed on a replica set member or mongos/i.test(errorMessage);
    }

    private isDuplicateApplicationNumberError(error: any): boolean {
        const keyValue = error?.keyValue || error?.errorResponse?.keyValue || {};
        return error?.code === 11000 && Boolean(keyValue.applicationNumber);
    }

    private buildGenericRegistrationError(error: any): InternalServerErrorException {
        this.logger.error('Applicant registration failed after retries:', error);
        return new InternalServerErrorException('Registration failed. Please try again.');
    }

    private async buildApplicantApplicationWithNumber(data: {
        userId: Types.ObjectId;
        programId: string;
        activeSessionId: Types.ObjectId;
        dateOfBirth?: string;
        gender?: string;
        session?: ClientSession;
    }) {
        const applicationNumber = await this.applicationNumberService.generateApplicationNumber(
            data.programId,
            data.activeSessionId.toString(),
            data.session,
        );

        return this.createApplicantApplication({
            ...data,
            applicationNumber,
        });
    }

    async register(registerDto: RegisterDto) {
        const {
            email,
            password,
            firstName,
            otherName,
            lastName,
            phone,
            dateOfBirth,
            gender,
            programTypeId,
            programModeId,
            programId
        } = registerDto;

        // First, check if registration is currently allowed
        const eligibility = await this.applicationEligibilityService.checkRegistrationEligibility();
        if (!eligibility.eligible) {
            throw new BadRequestException(eligibility.reason);
        }

        const activeSession = eligibility.activeSession as any; // Cast to any to access _id
        this.logger.log('Registration eligibility check passed', {
            activeSessionId: activeSession._id,
            sessionYear: activeSession.sessionYear
        });

        // Check if user already exists
        const existingUser = await this.userModel.findOne({ email });
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Validate that the program combination exists
        const resolvedProgram = await resolveProgramSelection({
            programModel: this.programModel,
            programId,
            providedProgramTypeId: programTypeId,
            providedProgramModeId: programModeId,
            logger: this.logger,
            logContext: { email },
        });

        // Generate email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        let user;
        let application;
        let session = null;

        const createRecordsWithFallback = async () => {
            user = this.buildApplicantUser({
                email,
                password,
                firstName,
                otherName,
                lastName,
                phone,
                verificationToken,
                tokenExpires,
            });

            await user.save();

            try {
                let lastError;

                for (let attempt = 1; attempt <= this.maxApplicationNumberRetries; attempt += 1) {
                    try {
                        application = await this.buildApplicantApplicationWithNumber({
                            userId: user._id,
                            programId: resolvedProgram.programId,
                            activeSessionId: activeSession._id,
                            dateOfBirth,
                            gender,
                        });

                        await application.save();

                        if (attempt > 1) {
                            this.logger.log('Applicant registration fallback recovered after duplicate application number retry', {
                                email,
                                applicationNumber: application.applicationNumber,
                                attempt,
                            });
                        }

                        return;
                    } catch (error) {
                        lastError = error;

                        if (!this.isDuplicateApplicationNumberError(error) || attempt === this.maxApplicationNumberRetries) {
                            throw error;
                        }

                        this.logger.warn('Duplicate application number encountered during fallback registration; retrying application number generation', {
                            email,
                            attempt,
                            maxAttempts: this.maxApplicationNumberRetries,
                            applicationNumber: error?.keyValue?.applicationNumber || application?.applicationNumber,
                        });
                    }
                }

                throw lastError;
            } catch (error) {
                try {
                    await this.userModel.deleteOne({ _id: user._id });
                    this.logger.warn('Applicant registration fallback rolled back created user after downstream failure', {
                        userId: user._id,
                        email,
                    });
                } catch (cleanupError) {
                    this.logger.error('Failed to rollback applicant user during fallback cleanup:', cleanupError);
                }

                throw error;
            }
        };

        try {
            let lastError;

            for (let attempt = 1; attempt <= this.maxApplicationNumberRetries; attempt += 1) {
                session = await this.userModel.db.startSession();

                try {
                    session.startTransaction();

                    user = this.buildApplicantUser({
                        email,
                        password,
                        firstName,
                        otherName,
                        lastName,
                        phone,
                        verificationToken,
                        tokenExpires,
                    });

                    await user.save({ session });

                    application = await this.buildApplicantApplicationWithNumber({
                        userId: user._id,
                        programId: resolvedProgram.programId,
                        activeSessionId: activeSession._id,
                        dateOfBirth,
                        gender,
                        session,
                    });
                    await application.save({ session });

                    await session.commitTransaction();

                    if (attempt > 1) {
                        this.logger.log('Applicant registration transaction succeeded after duplicate application number retry', {
                            email,
                            applicationNumber: application.applicationNumber,
                            attempt,
                        });
                    }

                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;

                    if (session?.inTransaction()) {
                        await session.abortTransaction();
                    }

                    if (this.isTransactionUnsupportedError(error)) {
                        this.logger.warn('MongoDB transactions are unavailable; falling back to standalone-safe registration flow');
                        await createRecordsWithFallback();
                        lastError = null;
                        break;
                    }

                    if (this.isDuplicateApplicationNumberError(error) && attempt < this.maxApplicationNumberRetries) {
                        this.logger.warn('Duplicate application number encountered during transactional registration; retrying with a fresh number', {
                            email,
                            attempt,
                            maxAttempts: this.maxApplicationNumberRetries,
                            applicationNumber: error?.keyValue?.applicationNumber || application?.applicationNumber,
                        });
                        continue;
                    }

                    throw error;
                } finally {
                    if (session) {
                        await session.endSession();
                        session = null;
                    }
                }
            }

            if (lastError) {
                throw lastError;
            }
        } catch (error) {
            if (error instanceof ConflictException || error instanceof BadRequestException) {
                throw error;
            }

            if (this.isDuplicateApplicationNumberError(error)) {
                throw this.buildGenericRegistrationError(error);
            }

            this.logger.error('Applicant registration transaction failed:', error);
            throw this.buildGenericRegistrationError(error);
        }

        this.logger.log('Application created successfully', {
            applicationId: application._id,
            applicationNumber: application.applicationNumber,
            entryAcademicSession: activeSession._id,
            sessionYear: activeSession.sessionYear
        });

        // Generate JWT token
        const payload = { email: user.email, sub: user._id, role: user.role };
        const access_token = this.jwtService.sign(payload);

        // Send verification email
        try {
            await this.emailService.sendVerificationEmail(email, firstName, verificationToken);
        } catch (error) {
            this.logger.warn('Failed to send verification email:', error);
            // Don't fail registration if email sending fails
        }

        return {
            access_token,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                otherName: user.otherName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                fullName: user.fullName,
                isEmailVerified: user.isEmailVerified,
            },
            applicationId: application._id,
            applicationNumber: application.applicationNumber,
            academicSession: {
                id: activeSession._id,
                sessionYear: activeSession.sessionYear
            }
        };
    }

    async checkRegistrationEligibility() {
        try {
            const eligibility = await this.applicationEligibilityService.checkRegistrationEligibility();
            return {
                success: true,
                data: {
                    eligible: eligibility.eligible,
                    reason: eligibility.reason,
                    academicSession: eligibility.activeSession ? {
                        id: (eligibility.activeSession as any)._id,
                        sessionYear: eligibility.activeSession.sessionYear,
                        status: eligibility.activeSession.status
                    } : null
                }
            };
        } catch (error) {
            this.logger.error('Error checking registration eligibility:', error);
            return {
                success: false,
                message: 'Failed to check registration eligibility',
                data: {
                    eligible: false,
                    reason: 'System error occurred. Please try again later.'
                }
            };
        }
    }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        // Find user by email
        const user = await this.userModel.findOne({ email });
        if (!user) {
            throw new UnauthorizedException('No account found with this email address');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Your account has been deactivated. Please contact support');
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Incorrect password. Please try again');
        }

        // Generate JWT token
        const payload = { email: user.email, sub: user._id, role: user.role };
        const access_token = this.jwtService.sign(payload);

        // Get application if user is an applicant or student
        let applicationData = null;
        if (user.role === UserRole.APPLICANT || user.role === UserRole.STUDENT) {
            const application = await this.applicationModel
                .findOne({ userId: user._id })
                .populate({
                    path: 'programId',
                    select: 'name code programTypeId programModeId',
                    populate: [
                        { path: 'programTypeId', select: 'type description' },
                        { path: 'programModeId', select: 'mode description' },
                    ],
                })
                .exec();

            if (application) {
                applicationData = await this.mapApplicationResponse(application);
            }
        }

        return {
            access_token,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                otherName: user.otherName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                fullName: user.fullName,
                isEmailVerified: user.isEmailVerified,
                isActive: user.isActive,
            },
            application: applicationData,
            // Keep backward compatibility
            applicationId: applicationData?.id,
        };
    }

    async validateUser(email: string, password: string): Promise<any> {
        const user = await this.userModel.findOne({ email });
        if (user && await user.comparePassword(password)) {
            const { passwordHash, ...result } = user.toObject();
            return result;
        }
        return null;
    }

    async getApplicationById(applicationId: string) {
        try {
            const application = await this.applicationModel
                .findById(applicationId)
                .populate({
                    path: 'programId',
                    select: 'name code programTypeId programModeId',
                    populate: [
                        { path: 'programTypeId', select: 'type description' },
                        { path: 'programModeId', select: 'mode description' },
                    ],
                })
                .exec();

            if (!application) {
                throw new BadRequestException('Application not found');
            }

            return {
                success: true,
                data: await this.mapApplicationResponse(application)
            };
        } catch (error) {
            throw new BadRequestException('Failed to fetch application details');
        }
    }

    async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
        const { currentPassword, newPassword } = changePasswordDto;

        try {
            // Find the user
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isCurrentPasswordValid) {
                throw new UnauthorizedException('Current password is incorrect');
            }

            // Check if new password is different from current password
            const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
            if (isSamePassword) {
                throw new BadRequestException('New password must be different from current password');
            }

            // Hash new password
            const saltRounds = 12;
            const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            await this.userModel.findByIdAndUpdate(userId, {
                passwordHash: hashedNewPassword,
                updatedAt: new Date()
            });

            // Send email notification
            try {
                await this.emailService.sendPasswordChangeNotification(
                    user.email,
                    user.firstName
                );
                this.logger.log(`Password change notification sent to ${user.email}`);
            } catch (emailError) {
                // Log email error but don't fail the password change
                this.logger.error(`Failed to send password change notification to ${user.email}:`, emailError.message);
                // Continue with success response since password was changed successfully
            }

            return {
                success: true,
                message: 'Password changed successfully'
            };

        } catch (error) {
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to change password');
        }
    }

    async getCurrentUserProfile(userId: string) {
        try {
            this.logger.log('getCurrentUserProfile called for userId:', userId);

            // Find the user
            const user = await this.userModel.findById(userId).select('-passwordHash');
            this.logger.log('User lookup result:', {
                found: !!user,
                userId: user?._id,
                email: user?.email,
                role: user?.role,
                isActive: user?.isActive
            });

            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            // Handle students differently - use Student collection as primary source
            if (user.role === UserRole.STUDENT) {
                this.logger.log('User is a student, delegating to StudentService');

                try {
                    const studentProfile = await this.studentService.getStudentProfile(userId);
                    this.logger.log('Student profile obtained from StudentService:', {
                        success: studentProfile.success,
                        hasStudent: !!studentProfile.data?.student,
                        matriculationNumber: studentProfile.data?.student?.matriculationNumber
                    });
                    return studentProfile;
                } catch (error) {
                    this.logger.warn('StudentService failed, falling back to Application-based profile:', error.message);
                    // Fall back to application-based profile if student record doesn't exist yet
                }
            }

            // Find the user's application (for applicants or students without student records yet)
            let application = null;
            if (user.role === UserRole.APPLICANT || user.role === UserRole.STUDENT) {
                application = await this.applicationModel
                    .findOne({ userId: user._id })
                    .populate({
                        path: 'programId',
                        select: 'name code programTypeId programModeId',
                        populate: [
                            { path: 'programTypeId', select: 'type description' },
                            { path: 'programModeId', select: 'mode description' },
                        ],
                    })
                    .exec();

                this.logger.log('Application data found for user profile:', {
                    userId,
                    userRole: user.role,
                    hasApplication: !!application,
                    applicationId: application?._id,
                    hasDob: !!application?.dob,
                    hasGender: !!application?.gender,
                    dobValue: application?.dob,
                    genderValue: application?.gender
                });
            }

            const result = {
                success: true,
                data: {
                    user: {
                        id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        otherName: user.otherName,
                        lastName: user.lastName,
                        phone: user.phone,
                        role: user.role,
                        isActive: user.isActive,
                        isEmailVerified: user.isEmailVerified,
                        fullName: user.fullName
                    },
                    application: application ? await this.mapApplicationResponse(application) : null
                }
            };

            this.logger.log('Profile response being returned:', {
                success: result.success,
                hasUser: !!result.data?.user,
                hasApplication: !!result.data?.application,
                userRole: result.data?.user?.role,
                userIsActive: result.data?.user?.isActive
            });

            // Log the actual result structure being returned
            this.logger.log('FULL RESULT STRUCTURE:', JSON.stringify(result, null, 2));

            return result;

        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new BadRequestException('Failed to fetch user profile');
        }
    }

    async verifyEmail(token: string) {
        try {
            // Find user with valid verification token
            const user = await this.userModel.findOne({
                emailVerificationToken: token,
                emailVerificationTokenExpires: { $gt: new Date() },
                isEmailVerified: false
            });

            if (!user) {
                throw new BadRequestException('Invalid or expired verification token');
            }

            // Mark email as verified and clear token
            user.isEmailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationTokenExpires = undefined;
            await user.save();

            // Update application stage from 1 to 2
            const application = await this.applicationModel.findOne({ userId: user._id });
            if (application && application.currentStage === 1) {
                application.currentStage = 2;
                await application.save();
                this.logger.log(`Advanced user ${user._id} from stage 1 to stage 2 after email verification`);
            }

            // Send welcome email
            try {
                await this.emailService.sendWelcomeEmail(user.email, user.firstName);
            } catch (error) {
                this.logger.warn('Failed to send welcome email:', error);
                // Don't fail verification if welcome email fails
            }

            return {
                success: true,
                message: 'Email verified successfully',
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isEmailVerified: true
                }
            };

        } catch (error) {
            this.logger.error('Email verification failed:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Email verification failed');
        }
    }

    async resendVerificationEmail(email: string) {
        try {
            const user = await this.userModel.findOne({
                email,
                isEmailVerified: false
            });

            if (!user) {
                throw new BadRequestException('User not found or email already verified');
            }

            // Generate new verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            user.emailVerificationToken = verificationToken;
            user.emailVerificationTokenExpires = tokenExpires;
            await user.save();

            // Send verification email
            await this.emailService.sendVerificationEmail(email, user.firstName, verificationToken);

            return {
                success: true,
                message: 'Verification email sent successfully'
            };

        } catch (error) {
            this.logger.error('Resend verification email failed:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to resend verification email');
        }
    }

    async forgotPassword(email: string) {
        try {
            this.logger.log('Password reset requested for:', email);

            // Find user by email (applicants and students)
            const user = await this.userModel.findOne({
                email,
                role: { $in: [UserRole.APPLICANT, UserRole.STUDENT] }
            });

            if (!user) {
                throw new BadRequestException('No account found with this email address');
            }

            // Generate random password
            const newPassword = this.generateRandomPassword();

            // Update user password (the pre-save hook will handle hashing)
            user.passwordHash = newPassword;
            await user.save();

            // Send email with new password
            try {
                await this.emailService.sendPasswordReset(
                    user.email,
                    user.firstName,
                    newPassword
                );

                this.logger.log('Password reset email sent successfully to:', email);

                return {
                    success: true,
                    message: 'New password has been sent to your email address'
                };
            } catch (emailError) {
                this.logger.error('Failed to send password reset email:', emailError);
                throw new BadRequestException('Failed to send password reset email. Please try again later.');
            }

        } catch (error) {
            this.logger.error('Password reset failed:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to reset password');
        }
    }

    private generateRandomPassword(): string {
        const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
        const numberChars = '0123456789';
        const specialChars = '!@#$%^&*';

        // Ensure at least one of each type
        const password = [
            uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)],
            lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)],
            numberChars[Math.floor(Math.random() * numberChars.length)],
            specialChars[Math.floor(Math.random() * specialChars.length)],
        ];

        // Fill the rest with random characters from all sets
        const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
        const remainingLength = 12 - password.length; // Total length 12

        for (let i = 0; i < remainingLength; i++) {
            password.push(allChars[Math.floor(Math.random() * allChars.length)]);
        }

        // Shuffle the password array to randomize position of required characters
        for (let i = password.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [password[i], password[j]] = [password[j], password[i]];
        }

        return password.join('');
    }

    // Staff authentication methods
    async staffLogin(loginDto: LoginDto) {
        const { email, password } = loginDto;

        this.logger.log('Staff login attempt:', { email });

        // Find user by email first
        const user = await this.userModel.findOne({ email });

        if (!user) {
            throw new UnauthorizedException('No account found with this email address');
        }

        // Check if user has staff or admin role
        if (!['staff', 'admin'].includes(user.role)) {
            throw new UnauthorizedException('Access denied: Your account does not have staff privileges');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Your staff account has been deactivated. Please contact administrator');
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Incorrect password. Please try again');
        }

        // Get staff details and role permissions
        const staff = await this.staffModel
            .findOne({ userId: user._id })
            .populate('roleId')
            .exec();

        if (!staff || !staff.isActive) {
            throw new UnauthorizedException('Staff record not found or inactive');
        }

        const role = staff.roleId as any;

        // Generate JWT token with staff information
        const payload = {
            email: user.email,
            sub: user._id,
            role: user.role,
            staffId: staff.staffId
        };
        const access_token = this.jwtService.sign(payload);

        // Prepare staff user data
        const staffUserData = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            fullName: user.fullName,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            // Staff specific data
            staffId: staff.staffId,
            department: staff.department,
            position: staff.position,
            // Role and permissions
            roleId: role._id,
            roleName: role.name,
            permissions: this.extractPermissions(role.modules || []),
            modules: (role.modules || []).map((m: any) => m.module)
        };

        this.logger.log('Staff login successful:', {
            email,
            staffId: staff.staffId,
            role: user.role
        });

        return {
            success: true,
            message: 'Staff login successful',
            data: {
                access_token,
                user: staffUserData
            }
        };
    }

    // Helper method to extract permissions from role modules
    private extractPermissions(modules: any[]): string[] {
        const permissions = new Set<string>();

        modules.forEach(module => {
            if (module.permissions && Array.isArray(module.permissions)) {
                module.permissions.forEach(permission => {
                    permissions.add(permission);
                    // Also add module-specific permissions
                    permissions.add(`${module.module}:${permission}`);
                });
            }
        });

        return Array.from(permissions);
    }

    async getStaffProfile(userId: string) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            const staff = await this.staffModel
                .findOne({ userId: user._id })
                .populate('roleId')
                .exec();

            if (!staff) {
                throw new UnauthorizedException('Staff record not found');
            }

            const role = staff.roleId as any;

            const staffUserData = {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                fullName: user.fullName,
                role: user.role,
                isActive: user.isActive,
                isEmailVerified: user.isEmailVerified,
                staffId: staff.staffId,
                department: staff.department,
                position: staff.position,
                roleId: role._id,
                roleName: role.name,
                permissions: this.extractPermissions(role.modules || []),
                modules: (role.modules || []).map((m: any) => m.module)
            };

            return {
                success: true,
                data: {
                    user: staffUserData
                }
            };

        } catch (error) {
            this.logger.error('Get staff profile failed:', error);
            throw error;
        }
    }
}
