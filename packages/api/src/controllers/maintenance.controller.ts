import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AcademicSessionsService } from '../services/academic-sessions.service';
import { Application, ApplicationDocument } from '../schemas/application.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
    private readonly logger = new Logger(MaintenanceController.name);

    constructor(
        private readonly academicSessionsService: AcademicSessionsService,
        @InjectModel(Application.name) private readonly applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) { }

    /**
     * Migrate dob and gender from Application records into their linked User profiles.
     * Body: { apply?: boolean }
     */
    @Post('migrate-user-demographics')
    async migrateUserDemographics(@Body('apply') apply?: boolean) {
        try {
            const applications = await this.applicationModel
                .find({ $or: [{ dob: { $exists: true, $ne: null } }, { gender: { $exists: true, $ne: null } }] })
                .select('userId dob gender')
                .lean() as any[];

            let scanned = 0;
            let migrated = 0;
            let skipped = 0;
            let alreadySet = 0;

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

            return {
                success: true,
                data: { scanned, migrated, skipped, alreadySet, applied: Boolean(apply) },
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
