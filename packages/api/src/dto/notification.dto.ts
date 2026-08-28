import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsMongoId,
    IsOptional,
    IsString,
    IsUrl,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import {
    NOTIFICATION_MESSAGE_HTML_MAX_LENGTH,
    NotificationAudienceType,
} from '../schemas/notification.schema';

export class NotificationAudienceDto {
    @IsEnum(NotificationAudienceType)
    type: NotificationAudienceType;

    @ValidateIf((value) => value.type === NotificationAudienceType.STUDENT_COHORT)
    @IsMongoId()
    programId?: string;

    @ValidateIf((value) => value.type === NotificationAudienceType.STUDENT_COHORT)
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    level?: number;

    @ValidateIf((value) => value.type === NotificationAudienceType.SPECIFIC_USERS)
    @IsArray()
    @ArrayMaxSize(2000)
    @IsMongoId({ each: true })
    userIds?: string[];
}

export class NotificationActionDto {
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    label: string;

    @IsString()
    @MinLength(1)
    @MaxLength(500)
    url: string;
}

export class CreateNotificationDto {
    @IsString()
    @MinLength(2)
    @MaxLength(140)
    title: string;

    @IsString()
    @MinLength(2)
    @MaxLength(NOTIFICATION_MESSAGE_HTML_MAX_LENGTH)
    messageHtml: string;

    @IsOptional()
    @IsEnum(['general', 'admissions', 'academic', 'payment', 'system', 'emergency'])
    category?: string;

    @IsOptional()
    @IsEnum(['normal', 'high', 'urgent'])
    priority?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => NotificationActionDto)
    action?: NotificationActionDto;

    @ValidateNested()
    @Type(() => NotificationAudienceDto)
    audience: NotificationAudienceDto;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}

export class ScheduleNotificationDto {
    @IsDateString()
    scheduledAt: string;
}

export class NotificationCommentDto {
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    comment?: string;
}

export class AudiencePreviewDto {
    @ValidateNested()
    @Type(() => NotificationAudienceDto)
    audience: NotificationAudienceDto;
}
