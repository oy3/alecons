import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
    AudiencePreviewDto,
    CreateNotificationDto,
    NotificationCommentDto,
    ScheduleNotificationDto,
    UpdateNotificationDto,
} from '../dto/notification.dto';
import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { NotificationsService } from '../services/notifications.service';
import { NotificationStatus } from '../schemas/notification.schema';

@ApiTags('Staff Notifications')
@ApiBearerAuth()
@Controller('staff/notifications')
@UseGuards(JwtAuthGuard)
export class StaffNotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly deliveryService: NotificationDeliveryService,
    ) {}

    private userId(req: any) { return String(req.user._id); }

    @Get()
    async list(
        @Request() req: any,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('status') status?: string,
        @Query('category') category?: string,
        @Query('search') search?: string,
    ) {
        return { success: true, data: await this.notificationsService.listManagement(this.userId(req), { page: Number(page), limit: Number(limit), status, category, search }) };
    }

    @Get('stats')
    async stats(@Request() req: any) {
        return { success: true, data: await this.notificationsService.managementStats(this.userId(req)) };
    }

    @Get('recipient-search')
    async recipientSearch(
        @Request() req: any,
        @Query('search') search = '',
        @Query('role') role?: string,
        @Query('limit') limit = '20',
    ) {
        return { success: true, data: await this.notificationsService.recipientSearch(this.userId(req), search, role, Number(limit)) };
    }

    @Post('audience-preview')
    async audiencePreview(@Request() req: any, @Body() payload: AudiencePreviewDto) {
        return { success: true, data: await this.notificationsService.preview(this.userId(req), payload) };
    }

    @Post()
    async create(@Request() req: any, @Body() payload: CreateNotificationDto) {
        return { success: true, data: await this.notificationsService.create(this.userId(req), payload) };
    }

    @Get(':id')
    async detail(@Request() req: any, @Param('id') id: string) {
        await this.notificationsService.assertPermission(this.userId(req), 'view');
        return { success: true, data: await this.notificationsService.managementDetail(id) };
    }

    @Patch(':id')
    async update(@Request() req: any, @Param('id') id: string, @Body() payload: UpdateNotificationDto) {
        return { success: true, data: await this.notificationsService.update(this.userId(req), id, payload) };
    }

    @Delete(':id')
    async remove(@Request() req: any, @Param('id') id: string) {
        return { success: true, data: await this.notificationsService.removeDraft(this.userId(req), id) };
    }

    @Post(':id/publish')
    async publish(@Request() req: any, @Param('id') id: string) {
        const notification = await this.notificationsService.beginPublish(this.userId(req), id);
        try {
            await this.deliveryService.enqueue(String(notification._id));
        } catch (error) {
            await this.notificationsService.releaseQueueClaim(
                String(notification._id),
                NotificationStatus.DRAFT,
                error,
            );
            throw error;
        }
        return { success: true, message: 'Notification queued for delivery', data: { id, status: notification.status } };
    }

    @Post(':id/duplicate')
    async duplicate(@Request() req: any, @Param('id') id: string) {
        return { success: true, data: await this.notificationsService.duplicate(this.userId(req), id) };
    }

    @Post(':id/schedule')
    async schedule(@Request() req: any, @Param('id') id: string, @Body() payload: ScheduleNotificationDto) {
        return { success: true, data: await this.notificationsService.schedule(this.userId(req), id, new Date(payload.scheduledAt)) };
    }

    @Post(':id/cancel')
    async cancel(@Request() req: any, @Param('id') id: string, @Body() payload: NotificationCommentDto) {
        return { success: true, data: await this.notificationsService.cancel(this.userId(req), id, payload.comment) };
    }

    @Patch(':id/archive')
    async archive(@Request() req: any, @Param('id') id: string, @Body() payload: NotificationCommentDto) {
        return { success: true, data: await this.notificationsService.archive(this.userId(req), id, payload.comment) };
    }

    @Get(':id/recipients')
    async recipients(
        @Request() req: any,
        @Param('id') id: string,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('read') read?: string,
    ) {
        return { success: true, data: await this.notificationsService.managementRecipients(this.userId(req), id, Number(page), Number(limit), read) };
    }
}
