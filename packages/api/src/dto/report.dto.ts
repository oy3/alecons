import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class ReportQueryDto {
  @IsOptional() @IsMongoId() academicSessionId?: string;
  @IsOptional() @IsMongoId() programTypeId?: string;
  @IsOptional() @IsMongoId() programModeId?: string;
  @IsOptional() @IsMongoId() programId?: string;
  @IsOptional() @IsMongoId() departmentId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) level?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 2]) semester?: number;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() compare?: boolean;
}

export class ReportRequestQueryDto extends ReportQueryDto {
  @IsOptional() @IsIn(['true', 'false']) refresh?: string;
}

export class ReportDetailQueryDto extends ReportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 25;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

export class ExportReportDto extends ReportQueryDto {
  @IsIn(['overview', 'admissions', 'students', 'finance', 'academics', 'exams', 'communications', 'activity'])
  reportType: string;

  @IsIn(['csv', 'xlsx', 'pdf'])
  format: string;
}

export class CreateScheduledReportDto extends ExportReportDto {
  @IsString() @MaxLength(120) name: string;
  @IsIn(['daily', 'weekly', 'monthly'])
  frequency: 'daily' | 'weekly' | 'monthly';
  @ValidateIf((value) => value.frequency === 'weekly') @Type(() => Number) @IsInt() @Min(0) @Max(6)
  dayOfWeek?: number;
  @ValidateIf((value) => value.frequency === 'monthly') @Type(() => Number) @IsInt() @Min(1) @Max(28)
  dayOfMonth?: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsEmail({}, { each: true }) recipients: string[];
}

export class UpdateScheduledReportDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
}

export class PortalActivityDto {
  @IsIn(['staff', 'student', 'application']) portal: string;
  @IsOptional() @IsIn(['page_view', 'login']) eventType = 'page_view';
  @IsString() @MaxLength(120) routeName: string;
  @IsOptional() @IsString() @MaxLength(300) pathTemplate?: string;
}
