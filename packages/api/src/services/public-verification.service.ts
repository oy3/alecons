import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';

@Injectable()
export class PublicVerificationService {
    private readonly logger = new Logger(PublicVerificationService.name);

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    ) { }

    async ensureVerificationDetailsForUser(userId: string) {
        if (!Types.ObjectId.isValid(userId)) {
            throw new NotFoundException('Invalid user ID');
        }

        const user = await this.userModel.findById(userId).select('role').lean();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role === UserRole.STUDENT) {
            return this.ensureStudentVerificationDetails(new Types.ObjectId(userId));
        }

        if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
            return this.ensureStaffVerificationDetails(new Types.ObjectId(userId));
        }

        throw new NotFoundException('Verification is only available for admitted students and staff records.');
    }

    async getPublicVerificationRecord(token: string) {
        const student = await this.studentModel
            .findOne({
                publicVerificationToken: token,
                publicVerificationEnabled: { $ne: false },
            })
            .populate('userId', 'firstName otherName lastName isActive')
            .populate({
                path: 'programId',
                select: 'name departmentId programTypeId programModeId',
                populate: [
                    { path: 'departmentId', select: 'name' },
                    { path: 'programTypeId', select: 'type' },
                    { path: 'programModeId', select: 'mode' },
                ],
            })
            .lean();

        if (student) {
            return {
                success: true,
                data: {
                    type: 'student',
                    verifiedAt: new Date().toISOString(),
                    identity: this.buildStudentPublicPayload(student),
                },
            };
        }

        const staff = await this.staffModel
            .findOne({
                publicVerificationToken: token,
                publicVerificationEnabled: { $ne: false },
            })
            .populate('userId', 'firstName otherName lastName isActive')
            .lean();

        if (staff) {
            return {
                success: true,
                data: {
                    type: 'staff',
                    verifiedAt: new Date().toISOString(),
                    identity: this.buildStaffPublicPayload(staff),
                },
            };
        }

        throw new NotFoundException('Verification record not found.');
    }

    async backfillVerificationTokens() {
        const [students, staffMembers] = await Promise.all([
            this.studentModel
                .find({
                    matriculationNumber: { $exists: true, $nin: [null, ''] },
                    $or: [
                        { publicVerificationToken: { $exists: false } },
                        { publicVerificationToken: null },
                        { publicVerificationToken: '' },
                    ],
                })
                .select('_id matriculationNumber publicVerificationToken')
                .exec(),
            this.staffModel
                .find({
                    staffId: { $exists: true, $nin: [null, ''] },
                    $or: [
                        { publicVerificationToken: { $exists: false } },
                        { publicVerificationToken: null },
                        { publicVerificationToken: '' },
                    ],
                })
                .select('_id staffId publicVerificationToken')
                .exec(),
        ]);

        let studentTokensGenerated = 0;
        let staffTokensGenerated = 0;

        for (const student of students) {
            student.publicVerificationToken = await this.generateUniqueToken('stu');
            await student.save();
            studentTokensGenerated += 1;
        }

        for (const staff of staffMembers) {
            staff.publicVerificationToken = await this.generateUniqueToken('stf');
            await staff.save();
            staffTokensGenerated += 1;
        }

        this.logger.log(
            `Public verification token backfill complete. students=${studentTokensGenerated}, staff=${staffTokensGenerated}`,
        );

        return {
            studentsScanned: students.length,
            staffScanned: staffMembers.length,
            studentTokensGenerated,
            staffTokensGenerated,
            totalTokensGenerated: studentTokensGenerated + staffTokensGenerated,
        };
    }

    private async ensureStudentVerificationDetails(userId: Types.ObjectId) {
        const student = await this.studentModel
            .findOne({ userId })
            .populate('userId', 'firstName otherName lastName isActive')
            .populate({
                path: 'programId',
                select: 'name departmentId programTypeId programModeId',
                populate: [
                    { path: 'departmentId', select: 'name' },
                    { path: 'programTypeId', select: 'type' },
                    { path: 'programModeId', select: 'mode' },
                ],
            })
            .exec();

        if (!student) {
            throw new NotFoundException('Student record not found');
        }

        if (!student.matriculationNumber) {
            throw new NotFoundException('Student matriculation number is not available');
        }

        if (!student.publicVerificationToken) {
            student.publicVerificationToken = await this.generateUniqueToken('stu');
            await student.save();
        }

        return {
            success: true,
            data: {
                type: 'student',
                token: student.publicVerificationToken,
                verificationUrl: this.buildVerificationUrl(student.publicVerificationToken),
                barcode: {
                    type: 'code128',
                    value: this.normalizeIdentifier(student.matriculationNumber),
                    displayValue: student.matriculationNumber,
                },
                identifier: {
                    label: 'Matric Number',
                    value: student.matriculationNumber,
                    normalizedValue: this.normalizeIdentifier(student.matriculationNumber),
                },
                identity: this.buildStudentPublicPayload(student.toObject()),
            },
        };
    }

    private async ensureStaffVerificationDetails(userId: Types.ObjectId) {
        const staff = await this.staffModel
            .findOne({ userId })
            .populate('userId', 'firstName otherName lastName isActive')
            .exec();

        if (!staff) {
            throw new NotFoundException('Staff record not found');
        }

        if (!staff.staffId) {
            throw new NotFoundException('Staff ID is not available');
        }

        if (!staff.publicVerificationToken) {
            staff.publicVerificationToken = await this.generateUniqueToken('stf');
            await staff.save();
        }

        return {
            success: true,
            data: {
                type: 'staff',
                token: staff.publicVerificationToken,
                verificationUrl: this.buildVerificationUrl(staff.publicVerificationToken),
                barcode: {
                    type: 'code128',
                    value: this.normalizeIdentifier(staff.staffId),
                    displayValue: staff.staffId,
                },
                identifier: {
                    label: 'Staff ID',
                    value: staff.staffId,
                    normalizedValue: this.normalizeIdentifier(staff.staffId),
                },
                identity: this.buildStaffPublicPayload(staff.toObject()),
            },
        };
    }

    private buildStudentPublicPayload(student: any) {
        const user = student.userId || {};
        const program = student.programId || {};
        const programme = [program.programTypeId?.type, program.programModeId?.mode, program.name]
            .filter(Boolean)
            .join(' ');

        return {
            fullName: [user.firstName, user.otherName, user.lastName].filter(Boolean).join(' '),
            matricNumber: student.matriculationNumber,
            programme: programme || 'N/A',
            department: program.departmentId?.name || 'N/A',
            currentLevel: student.currentLevel || null,
            status: this.toDisplayStatus(student.isActive === false ? 'inactive' : student.status || 'active'),
            photoUrl: student.profileImageUrl || null,
        };
    }

    private buildStaffPublicPayload(staff: any) {
        const user = staff.userId || {};

        return {
            fullName: [user.firstName, user.otherName, user.lastName].filter(Boolean).join(' '),
            staffId: staff.staffId,
            department: staff.department || 'N/A',
            position: staff.position || 'N/A',
            status: this.toDisplayStatus(staff.isActive === false || user.isActive === false ? 'inactive' : 'active'),
        };
    }

    private buildVerificationUrl(token: string) {
        const websiteUrl = String(process.env.WEBSITE_URL || 'https://alecons.edu.ng').replace(/\/$/, '');
        return `${websiteUrl}/verify/v1/${token}`;
    }

    private normalizeIdentifier(value: string) {
        return String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }

    private toDisplayStatus(value: string) {
        return String(value || 'unknown')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    private async generateUniqueToken(prefix: 'stu' | 'stf') {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const token = `${prefix}_${randomBytes(24).toString('base64url')}`;
            const [studentMatch, staffMatch] = await Promise.all([
                this.studentModel.exists({ publicVerificationToken: token }),
                this.staffModel.exists({ publicVerificationToken: token }),
            ]);

            if (!studentMatch && !staffMatch) {
                return token;
            }
        }

        this.logger.error('Failed to generate a unique public verification token');
        throw new Error('Unable to generate public verification token');
    }
}