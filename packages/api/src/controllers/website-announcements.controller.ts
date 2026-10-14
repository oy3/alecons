import {
    Body,
    Controller,
    Get,
    Header,
    Param,
    Patch,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import {
    IsBoolean,
    IsDateString,
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebsiteAnnouncementsService } from '../services/website-announcements.service';

export class AnnouncementRevisionDto {
    @IsInt() @Min(0) expectedRevision: number;
}

export class WebsiteAnnouncementDto extends AnnouncementRevisionDto {
    @IsString() @MinLength(1) @MaxLength(240) message: string;
    @IsOptional() @IsString() @MaxLength(500) linkUrl?: string;
    @IsOptional() @IsString() @MaxLength(50) linkLabel?: string;
    @IsOptional() @IsDateString() startsAt?: string;
    @IsOptional() @IsDateString() endsAt?: string;
    @IsOptional() @IsBoolean() replaceConfirmed?: boolean;
}

@Controller('staff/website-announcements')
@UseGuards(JwtAuthGuard)
export class StaffWebsiteAnnouncementsController {
    constructor(private readonly announcements: WebsiteAnnouncementsService) {}
    @Get() async list(@Request() req) {
        return {
            success: true,
            data: await this.announcements.list(String(req.user._id)),
        };
    }
    @Post() async create(
        @Request() req,
        @Body() payload: WebsiteAnnouncementDto,
    ) {
        return {
            success: true,
            data: await this.announcements.save(String(req.user._id), payload),
        };
    }
    @Patch(':id') async update(
        @Request() req,
        @Param('id') id: string,
        @Body() payload: WebsiteAnnouncementDto,
    ) {
        return {
            success: true,
            data: await this.announcements.save(
                String(req.user._id),
                payload,
                id,
            ),
        };
    }
    @Post(':id/expire') async expire(
        @Request() req,
        @Param('id') id: string,
        @Body() payload: AnnouncementRevisionDto,
    ) {
        return {
            success: true,
            data: await this.announcements.expire(
                String(req.user._id),
                id,
                payload.expectedRevision,
            ),
        };
    }
}

@Controller('public/website-announcements')
export class PublicWebsiteAnnouncementsController {
    constructor(private readonly announcements: WebsiteAnnouncementsService) {}
    @Get('active') @Header('Cache-Control', 'no-store') async active() {
        return { success: true, data: await this.announcements.active() };
    }
}
