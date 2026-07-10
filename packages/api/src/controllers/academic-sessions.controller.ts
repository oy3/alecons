import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    Logger,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AcademicSessionsService } from "../services/academic-sessions.service";
import {
    CreateAcademicSessionDto,
    UpdateAcademicSessionDto,
    QueryAcademicSessionsDto,
} from "../dto/academic-session.dto";
import { SessionControlsService } from "../services/session-controls.service";
import { EmailService } from "../services/email.service";

@Controller("academic-sessions")
@UseGuards(JwtAuthGuard)
export class AcademicSessionsController {
    private readonly logger = new Logger(AcademicSessionsController.name);

    constructor(
        private readonly academicSessionsService: AcademicSessionsService,
        private readonly sessionControlsService: SessionControlsService,
        private readonly emailService: EmailService,
    ) { }

    @Get()
    async getAcademicSessions(@Query() query: QueryAcademicSessionsDto) {
        try {
            const result = await this.academicSessionsService.findAll(query);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Get(":id")
    async getAcademicSession(@Param("id") id: string) {
        try {
            const academicSession = await this.academicSessionsService.findById(id);
            return {
                success: true,
                data: { academicSession },
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Post()
    async createAcademicSession(
        @Body() createAcademicSessionDto: CreateAcademicSessionDto,
        @Request() req
    ) {
        try {
            const academicSession = await this.academicSessionsService.create(
                createAcademicSessionDto,
                req.user.userId
            );

            // Create default session controls
            await this.sessionControlsService.createDefaultControls(
                (academicSession as any)._id,
                req.user.userId
            );

            return {
                success: true,
                data: { academicSession },
                message: "Academic session created successfully",
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Put(":id")
    async updateAcademicSession(
        @Param("id") id: string,
        @Body() updateAcademicSessionDto: UpdateAcademicSessionDto,
        @Request() req
    ) {
        try {
            const academicSession = await this.academicSessionsService.update(
                id,
                updateAcademicSessionDto,
                req.user.userId
            );
            return {
                success: true,
                data: { academicSession },
                message: "Academic session updated successfully",
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Delete(":id")
    async deleteAcademicSession(@Param("id") id: string) {
        try {
            await this.academicSessionsService.delete(id);
            return {
                success: true,
                message: "Academic session deleted successfully",
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Get(":id/controls")
    async getSessionControls(@Param("id") id: string) {
        try {
            const controls = await this.sessionControlsService.findBySessionId(id);
            return {
                success: true,
                data: { controls },
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Put(":id/controls")
    async updateSessionControls(
        @Param("id") id: string,
        @Body() controlsData: any,
        @Request() req
    ) {
        try {
            const { sessionControl: controls, expiredApplicants } =
                await this.sessionControlsService.updateControls(
                    id,
                    controlsData,
                    req.user.userId,
                );

            if (expiredApplicants.length > 0) {
                this.logger.log(
                    `Application window closed for session ${id}: expiring ${expiredApplicants.length
                    } stale application(s) and sending notifications.`,
                );

                // Fetch session year for the notification email (best-effort)
                let sessionYear: string | undefined;
                try {
                    const session = await this.academicSessionsService.findById(id);
                    sessionYear = (session as any)?.sessionYear;
                } catch { /* non-critical */ }

                // Fire-and-forget: don't block the API response
                Promise.all(
                    expiredApplicants.map(({ email, firstName }) =>
                        this.emailService.sendApplicationExpiredEmail(
                            email,
                            firstName,
                            sessionYear,
                        ),
                    ),
                ).catch((err) =>
                    this.logger.error(
                        'Failed to send application-expired notification emails:',
                        err,
                    ),
                );
            }

            return {
                success: true,
                data: { controls },
                message: "Session controls updated successfully",
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }
}
