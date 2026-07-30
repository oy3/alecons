import { IsString, IsDateString, IsBoolean, IsOptional, IsEnum, IsMongoId } from 'class-validator';
import { SessionStatus } from '../schemas/academic-session.schema';

export class CreateAcademicSessionDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(SessionStatus)
    status?: SessionStatus;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @IsMongoId()
    provostUserId?: string | null;
}

export class UpdateAcademicSessionDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(SessionStatus)
    status?: SessionStatus;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @IsMongoId()
    provostUserId?: string | null;
}

export class QueryAcademicSessionsDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(SessionStatus)
    status?: SessionStatus;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsString()
    limit?: string;

    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsString()
    sortOrder?: string;
}
