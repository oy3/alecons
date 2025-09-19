import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Application, ApplicationDocument } from '../schemas/application.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeDocument } from '../schemas/program-mode.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(ProgramType.name) private programTypeModel: Model<ProgramTypeDocument>,
        @InjectModel(ProgramMode.name) private programModeModel: Model<ProgramModeDocument>,
        private jwtService: JwtService,
    ) { }

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

        // Check if user already exists
        const existingUser = await this.userModel.findOne({ email });
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Validate that the program combination exists
        const program = await this.programModel.findById(programId);
        if (!program || !program.active) {
            throw new BadRequestException('Invalid program selected');
        }

        const programType = await this.programTypeModel.findById(programTypeId);
        if (!programType || !programType.active) {
            throw new BadRequestException('Invalid program type selected');
        }

        const programMode = await this.programModeModel.findById(programModeId);
        if (!programMode || !programMode.active) {
            throw new BadRequestException('Invalid program mode selected');
        }

        // Create new user
        const user = new this.userModel({
            email,
            passwordHash: password, // This will be hashed by the pre-save hook
            firstName,
            otherName,
            lastName,
            phone,
            role: UserRole.APPLICANT,
        });

        await user.save();

        // Generate application number manually
        const currentYear = new Date().getFullYear();
        const yearString = currentYear.toString().slice(-2); // Get last 2 digits
        const programCode = String(program.code).padStart(2, '0'); // Ensure 2 digits

        // Convert string IDs to ObjectIds
        const programObjectId = new Types.ObjectId(programId);
        const programTypeObjectId = new Types.ObjectId(programTypeId);
        const programModeObjectId = new Types.ObjectId(programModeId);

        // Count applications for this program in current year
        const applicationCount = await this.applicationModel.countDocuments({
            programId: programObjectId,
            createdAt: {
                $gte: new Date(currentYear, 0, 1),
                $lt: new Date(currentYear + 1, 0, 1)
            }
        });

        const applicationNumber = `ALEC${yearString}${programCode}${String(applicationCount + 1).padStart(4, '0')}`;

        // Create application record with all required data
        const applicationData: any = {
            userId: user._id,
            applicationNumber: applicationNumber,
            programId: programObjectId,
            programTypeId: programTypeObjectId,
            programModeId: programModeObjectId,
            status: 'pending',
            currentStage: 1,
            referees: [],
            examinations: [],
            documents: [],
        };

        // Add optional fields if provided
        if (dateOfBirth) applicationData.dob = new Date(dateOfBirth);
        if (gender) applicationData.gender = gender;

        const application = new this.applicationModel(applicationData);
        await application.save();

        // Generate JWT token
        const payload = { email: user.email, sub: user._id, role: user.role };
        const access_token = this.jwtService.sign(payload);

        return {
            access_token,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                otherName: user.otherName,
                lastName: user.lastName,
                role: user.role,
                fullName: user.fullName,
                phone: phone,
            },
            applicationId: application._id,
            applicationNumber: application.applicationNumber,
        };
    } async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        // Find user by email
        const user = await this.userModel.findOne({ email });
        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate JWT token
        const payload = { email: user.email, sub: user._id, role: user.role };
        const access_token = this.jwtService.sign(payload);

        // Get application if user is an applicant
        let applicationData = null;
        if (user.role === UserRole.APPLICANT) {
            const application = await this.applicationModel.findOne({ userId: user._id });
            if (application) {
                applicationData = {
                    id: application._id,
                    applicationNumber: application.applicationNumber,
                    currentStage: application.currentStage,
                    status: application.status
                };
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
                role: user.role,
                fullName: user.fullName,
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
                .populate('programId', 'name code')
                .populate('programTypeId', 'type')
                .populate('programModeId', 'mode')
                .exec();

            if (!application) {
                throw new BadRequestException('Application not found');
            }

            return {
                success: true,
                data: {
                    id: application._id,
                    applicationNumber: application.applicationNumber,
                    currentStage: application.currentStage,
                    status: application.status,
                    program: application.programId,
                    programType: application.programTypeId,
                    programMode: application.programModeId,
                }
            };
        } catch (error) {
            throw new BadRequestException('Failed to fetch application details');
        }
    }
}
