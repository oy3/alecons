import { Controller, Get, UseGuards, Logger, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Student, StudentDocument } from '../schemas/student.schema';

@ApiTags('Student Portal Academic Sessions')
@Controller('student/academic-sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudentAcademicSessionsController {
    private readonly logger = new Logger(StudentAcademicSessionsController.name);

    constructor(
        @InjectModel(Student.name)
        private readonly studentModel: Model<StudentDocument>,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get academic sessions available for students (excludes draft status)' })
    @ApiResponse({ status: 200, description: 'Academic sessions retrieved successfully' })
    async getAcademicSessions(@Request() req) {
        try {
            const student = await this.studentModel
                .findOne({ userId: new Types.ObjectId(req.user._id) })
                .populate('academicSession', 'sessionYear title startDate endDate status active')
                .lean();

            if (!student?.academicSession || typeof student.academicSession !== 'object') {
                return { success: true, data: { sessions: [] } };
            }

            return {
                success: true,
                // Staff progression assigns this session. A student never receives every
                // open session merely because its session year looks eligible.
                data: { sessions: [student.academicSession] }
            };
        } catch (error) {
            this.logger.error('Error getting academic sessions for student:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch academic sessions'
            };
        }
    }
}
