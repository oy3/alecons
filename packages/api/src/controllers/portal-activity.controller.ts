import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PortalActivityDto } from '../dto/report.dto';
import { PortalActivityService } from '../services/portal-activity.service';

@ApiTags('Portal Activity')
@ApiBearerAuth()
@Controller('analytics/activity')
@UseGuards(JwtAuthGuard)
export class PortalActivityController {
  constructor(private readonly activityService: PortalActivityService) {}

  @Post()
  async record(@Request() req: any, @Body() payload: PortalActivityDto) {
    return { success: true, data: await this.activityService.record(req.user, payload) };
  }
}
