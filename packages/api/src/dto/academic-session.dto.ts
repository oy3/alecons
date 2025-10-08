import { IsString, IsDateString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { SessionStatus } from '../schemas/academic-session.schema';

export class CreateAcademicSessionDto {
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
}

export class UpdateAcademicSessionDto {
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