import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Student, StudentDocument } from '../schemas/student.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Application, ApplicationDocument } from '../schemas/application.schema';
import { getNestedProgramRelation } from '../utils/program-relation.util';

@Injectable()
export class StudentService {
    private readonly logger = new Logger(StudentService.name);

    constructor(
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
    ) { }

    /**
     * Get student profile data using Student collection as primary source
     * This is the proper way to get student data - Student -> User + Application
     */
    async getStudentProfile(userId: string) {
        try {
            this.logger.log('Getting student profile for userId:', userId);

            // Find student record by userId
            const student = await this.studentModel
                .findOne({ userId: new Types.ObjectId(userId) })
                .populate({
                    path: 'userId',
                    model: 'User',
                    select: '-passwordHash'
                })
                .populate({
                    path: 'applicationId',
                    model: 'Application',
                    populate: {
                        path: 'programId',
                        select: 'name code programTypeId programModeId',
                        populate: [
                            { path: 'programTypeId', select: 'type description' },
                            { path: 'programModeId', select: 'mode description' },
                        ],
                    }
                })
                .populate({
                    path: 'programId',
                    select: 'name code programTypeId programModeId',
                    populate: [
                        { path: 'programTypeId', select: 'type description' },
                        { path: 'programModeId', select: 'mode description' },
                    ]
                })
                .populate({
                    path: 'academicSession',
                    select: 'name year isActive'
                })
                .exec();

            if (!student) {
                this.logger.warn(`No student record found for userId: ${userId}`);
                throw new NotFoundException('Student record not found');
            }

            this.logger.log('Student record found:', {
                studentId: student._id,
                matriculationNumber: student.matriculationNumber,
                hasUser: !!student.userId,
                hasApplication: !!student.applicationId
            });

            // Structure the response with student data as primary
            const result = {
                success: true,
                data: {
                    student: {
                        id: student._id,
                        matriculationNumber: student.matriculationNumber,
                        status: student.status,
                        currentLevel: student.currentLevel,
                        currentSemester: student.currentSemester,
                        cumulativeGPA: student.cumulativeGPA,
                        admissionYear: student.admissionYear,
                        profileImageUrl: student.profileImageUrl,
                        isActive: student.isActive,
                        graduationDate: student.graduationDate,
                        createdAt: (student as any).createdAt,
                        updatedAt: (student as any).updatedAt,
                        // Academic program info
                        program: student.programId,
                        programType: getNestedProgramRelation(student).programType,
                        programMode: getNestedProgramRelation(student).programMode,
                        academicSession: student.academicSession
                    },
                    user: student.userId ? {
                        id: (student.userId as any)._id,
                        email: (student.userId as any).email,
                        firstName: (student.userId as any).firstName,
                        otherName: (student.userId as any).otherName,
                        lastName: (student.userId as any).lastName,
                        phone: (student.userId as any).phone,
                        role: (student.userId as any).role,
                        isActive: (student.userId as any).isActive,
                        isEmailVerified: (student.userId as any).isEmailVerified,
                        fullName: (student.userId as any).fullName
                    } : null,
                    application: student.applicationId ? {
                        id: (student.applicationId as any)._id,
                        applicationNumber: (student.applicationId as any).applicationNumber,
                        currentStage: (student.applicationId as any).currentStage,
                        status: (student.applicationId as any).status,
                        // Personal data
                        dob: (student.applicationId as any).dob,
                        gender: (student.applicationId as any).gender,
                        phone: (student.applicationId as any).phone,
                        religion: (student.applicationId as any).religion,
                        maritalStatus: (student.applicationId as any).maritalStatus,
                        address: (student.applicationId as any).address,
                        nationality: (student.applicationId as any).nationality,
                        stateOfOrigin: (student.applicationId as any).stateOfOrigin,
                        lga: (student.applicationId as any).lga,
                        profileImageUrl: (student.applicationId as any).profileImageUrl,
                        // Nested structures
                        nextOfKin: (student.applicationId as any).nextOfKin,
                        referees: (student.applicationId as any).referees,
                        academicBackground: (student.applicationId as any).academicBackground,
                        examinations: (student.applicationId as any).examinations,
                        isJambExempt: (student.applicationId as any).isJambExempt,
                        jambRegistrationNumber: (student.applicationId as any).jambRegistrationNumber,
                        jambScore: (student.applicationId as any).jambScore,
                        documents: (student.applicationId as any).documents,
                        // Program references from application
                        program: getNestedProgramRelation(student.applicationId as any).program,
                        programType: getNestedProgramRelation(student.applicationId as any).programType,
                        programMode: getNestedProgramRelation(student.applicationId as any).programMode,
                        createdAt: (student.applicationId as any).createdAt,
                        updatedAt: (student.applicationId as any).updatedAt
                    } : null
                }
            };

            this.logger.log('Student profile response prepared:', {
                success: result.success,
                hasStudent: !!result.data.student,
                hasUser: !!result.data.user,
                hasApplication: !!result.data.application,
                matriculationNumber: result.data.student?.matriculationNumber
            });

            return result;

        } catch (error) {
            this.logger.error('Error getting student profile:', {
                userId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Get multiple students with pagination
     */
    async getStudents(page: number = 1, limit: number = 10, filters: any = {}) {
        const skip = (page - 1) * limit;

        const students = await this.studentModel
            .find(filters)
            .populate('userId', '-passwordHash')
            .populate({
                path: 'applicationId',
                populate: {
                    path: 'programId',
                    select: 'name code programTypeId programModeId',
                    populate: [
                        { path: 'programTypeId', select: 'type description' },
                        { path: 'programModeId', select: 'mode description' },
                    ],
                },
            })
            .populate({
                path: 'programId',
                select: 'name code programTypeId programModeId',
                populate: [
                    { path: 'programTypeId', select: 'type description' },
                    { path: 'programModeId', select: 'mode description' },
                ],
            })
            .populate('academicSession', 'name year isActive')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .exec();

        const total = await this.studentModel.countDocuments(filters);

        return {
            students,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Update student profile
     */
    async updateStudentProfile(userId: string, updates: Partial<Student>) {
        try {
            const student = await this.studentModel.findOneAndUpdate(
                { userId: new Types.ObjectId(userId) },
                updates,
                { new: true }
            ).exec();

            if (!student) {
                throw new NotFoundException('Student record not found');
            }

            return {
                success: true,
                data: student
            };

        } catch (error) {
            this.logger.error('Error updating student profile:', error);
            throw error;
        }
    }

    /**
     * Check if user has a student record
     */
    async hasStudentRecord(userId: string): Promise<boolean> {
        const count = await this.studentModel.countDocuments({
            userId: new Types.ObjectId(userId)
        });
        return count > 0;
    }
}