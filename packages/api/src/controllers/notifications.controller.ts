import { Controller, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from '../services/notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    async inbox(
        @Request() req: any,
        @Query('limit') limit = '15',
        @Query('before') before?: string,
        @Query('unreadOnly') unreadOnly?: string,
    ) {
        return {
            success: true,
            data: await this.notificationsService.inbox(
                String(req.user._id),
                Number(limit),
                before,
                unreadOnly === 'true',
            ),
        };
    }

    @Get('unread-count')
    async unreadCount(@Request() req: any) {
        return { success: true, data: await this.notificationsService.unreadCount(String(req.user._id)) };
    }

    @Patch('read-all')
    async markAllRead(@Request() req: any) {
        return { success: true, data: await this.notificationsService.markAllRead(String(req.user._id)) };
    }

    @Get(':recipientId')
    async detail(@Request() req: any, @Param('recipientId') recipientId: string) {
        return { success: true, data: await this.notificationsService.inboxDetail(String(req.user._id), recipientId) };
    }

    @Patch(':recipientId/read')
    async markRead(@Request() req: any, @Param('recipientId') recipientId: string) {
        return { success: true, data: await this.notificationsService.markRead(String(req.user._id), recipientId) };
    }
}

