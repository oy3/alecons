import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AcademicSessionsService } from '../services/academic-sessions.service';
import { Application, ApplicationDocument } from '../schemas/application.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { UploadService } from '../services/upload.service';

@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class MaintenanceController {
    private readonly logger = new Logger(MaintenanceController.name);

    constructor(
        private readonly academicSessionsService: AcademicSessionsService,
        @InjectModel(Application.name) private readonly applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        private readonly uploadService: UploadService,
    ) { }

    /**
     * Migrate applicant demographics and enrolled-student profile images into User profiles.
     * Body: { apply?: boolean }
     */
    @Post('migrate-user-demographics')
    async migrateUserDemographics(@Body('apply') apply?: boolean) {
        try {
            const applications = await this.applicationModel
                .find({
                    $or: [
                        { dob: { $exists: true, $ne: null } },
                        { gender: { $exists: true, $ne: null } },
                        { profileImageUrl: { $exists: true, $ne: null } },
                    ],
                })
                .select('userId dob gender profileImageUrl updatedAt')
                .sort({ updatedAt: -1, _id: -1 })
                .lean() as any[];

            let scanned = 0;
            let migrated = 0;
            let skipped = 0;
            let alreadySet = 0;
            let profileImagesEligible = 0;
            let profileImagesMigrated = 0;
            let profileImagesAlreadySet = 0;
            let profileImagesSkipped = 0;
            let profileImagesFailed = 0;

            for (const app of applications) {
                scanned++;
                const user = await this.userModel.findById(app.userId).select('dob gender').lean() as any;
                if (!user) { skipped++; continue; }

                const update: Record<string, any> = {};
                if (app.dob && !user.dob) update.dob = app.dob;
                if (app.gender && !user.gender) update.gender = app.gender;

                if (!Object.keys(update).length) { alreadySet++; continue; }

                if (apply) {
                    await this.userModel.updateOne({ _id: app.userId }, { $set: update });
                }
                migrated++;
            }

            const applicationsById = new Map(applications.map((app) => [app._id.toString(), app]));
            const students = await this.studentModel
                .find({})
                .select('userId applicationId matriculationNumber profileImageUrl')
                .lean() as any[];

            for (const student of students) {
                if (!student.matriculationNumber || !student.userId || !student.applicationId) {
                    profileImagesSkipped++;
                    continue;
                }

                const user = await this.userModel.findById(student.userId).select('profileImageUrl').lean() as any;
                if (!user) {
                    profileImagesSkipped++;
                    continue;
                }

                let application = applicationsById.get(student.applicationId.toString());
                if (!application) {
                    application = await this.applicationModel
                        .findById(student.applicationId)
                        .select('profileImageUrl')
                        .lean() as any;
                }

                const sourceUrl = user.profileImageUrl || student.profileImageUrl || application?.profileImageUrl;
                if (!sourceUrl) {
                    profileImagesSkipped++;
                    continue;
                }

                const destinationKey = this.uploadService.getStudentProfileKey(student.matriculationNumber, sourceUrl);
                if (!destinationKey) {
                    profileImagesSkipped++;
                    continue;
                }

                const destinationUrl = this.uploadService.getFileUrl(destinationKey);
                if (user.profileImageUrl === destinationUrl && student.profileImageUrl === destinationUrl) {
                    profileImagesAlreadySet++;
                    continue;
                }

                profileImagesEligible++;
                if (!apply) {
                    continue;
                }

                try {
                    const copiedProfileImage = await this.uploadService.copyProfileImageToStudentFolder(
                        sourceUrl,
                        student.matriculationNumber,
                    );
                    if (!copiedProfileImage) {
                        profileImagesSkipped++;
                        continue;
                    }

                    await Promise.all([
                        this.userModel.updateOne(
                            { _id: student.userId },
                            { $set: { profileImageUrl: copiedProfileImage.url } },
                        ),
                        this.studentModel.updateOne(
                            { _id: student._id },
                            { $set: { profileImageUrl: copiedProfileImage.url } },
                        ),
                    ]);
                    profileImagesMigrated++;
                } catch (imageError) {
                    profileImagesFailed++;
                    this.logger.error('Student profile image migration failed:', {
                        studentId: student._id?.toString(),
                        matriculationNumber: student.matriculationNumber,
                        error: imageError?.message || imageError,
                    });
                }
            }

            return {
                success: true,
                data: {
                    scanned,
                    migrated,
                    skipped,
                    alreadySet,
                    profileImagesEligible,
                    profileImagesMigrated,
                    profileImagesAlreadySet,
                    profileImagesSkipped,
                    profileImagesFailed,
                    applied: Boolean(apply),
                },
            };
        } catch (error) {
            this.logger.error('migrateUserDemographics failed:', error?.message || error);
            return { success: false, error: error?.message || 'Migration failed' };
        }
    }

    /**
     * Inspect legacy academic session index and optionally drop it.
     * Body: { apply?: boolean }
     */
    @Post('repair-academic-sessions')
    async repairAcademicSessions(@Body('apply') apply?: boolean) {
        try {
            const result = await this.academicSessionsService.inspectAndRepairLegacyIndex(Boolean(apply));
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error('repairAcademicSessions failed:', error?.message || error);
            return {
                success: false,
                error: error?.message || 'Repair failed',
            };
        }
    }
}
