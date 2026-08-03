import { IsString, IsOptional, IsNotEmpty, IsNumber, IsBoolean, IsMongoId, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProgramDto {
    @ApiProperty({ description: 'Department ID' })
    @IsMongoId()
    @IsNotEmpty()
    departmentId: string;

    @ApiProperty({ description: 'Program name' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ description: 'Program description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Minimum session units', minimum: 1 })
    @IsNumber()
    @Min(1)
    minUnits: number;

    @ApiProperty({ description: 'Maximum session units', minimum: 1 })
    @IsNumber()
    @Min(1)
    maxUnits: number;

    @ApiProperty({ description: 'Maximum failed courses eligible for resit in one semester', minimum: 1 })
    @IsNumber()
    @Min(1)
    maxResitCourses: number;

    @ApiPropertyOptional({ description: 'Course advisor user ID' })
    @IsMongoId()
    @IsOptional()
    courseAdvisorId?: string;

    @ApiProperty({ description: 'Program type ID' })
    @IsMongoId()
    @IsNotEmpty()
    programTypeId: string;

    @ApiProperty({ description: 'Program mode ID' })
    @IsMongoId()
    @IsNotEmpty()
    programModeId: string;

    @ApiProperty({ description: 'Duration in years', minimum: 1 })
    @IsNumber()
    @Min(1)
    durationYears: number;

    @ApiPropertyOptional({ description: 'Program active status', default: true })
    @IsBoolean()
    @IsOptional()
    active?: boolean;
}

export class UpdateProgramDto {
    @ApiPropertyOptional({ description: 'Department ID' })
    @IsMongoId()
    @IsOptional()
    departmentId?: string;

    @ApiPropertyOptional({ description: 'Program name' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ description: 'Program description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Minimum session units', minimum: 1 })
    @IsNumber()
    @Min(1)
    @IsOptional()
    minUnits?: number;

    @ApiPropertyOptional({ description: 'Maximum session units', minimum: 1 })
    @IsNumber()
    @Min(1)
    @IsOptional()
    maxUnits?: number;

    @ApiPropertyOptional({ description: 'Maximum failed courses eligible for resit in one semester', minimum: 1 })
    @IsNumber()
    @Min(1)
    @IsOptional()
    maxResitCourses?: number;

    @ApiPropertyOptional({ description: 'Course advisor user ID' })
    @IsMongoId()
    @IsOptional()
    courseAdvisorId?: string;

    @ApiPropertyOptional({ description: 'Program type ID' })
    @IsMongoId()
    @IsOptional()
    programTypeId?: string;

    @ApiPropertyOptional({ description: 'Program mode ID' })
    @IsMongoId()
    @IsOptional()
    programModeId?: string;

    @ApiPropertyOptional({ description: 'Duration in years', minimum: 1 })
    @IsNumber()
    @Min(1)
    @IsOptional()
    durationYears?: number;

    @ApiPropertyOptional({ description: 'Program active status' })
    @IsBoolean()
    @IsOptional()
    active?: boolean;
}

export class QueryProgramsDto {
    @ApiPropertyOptional({ description: 'Search term for program name or department' })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ description: 'Department ID to filter by' })
    @IsMongoId()
    @IsOptional()
    departmentId?: string;

    @ApiPropertyOptional({ description: 'Program type ID to filter by' })
    @IsMongoId()
    @IsOptional()
    programTypeId?: string;

    @ApiPropertyOptional({ description: 'Program mode ID to filter by' })
    @IsMongoId()
    @IsOptional()
    programModeId?: string;

    @ApiPropertyOptional({ description: 'Filter by active status' })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    active?: boolean;

    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsNumber()
    @IsOptional()
    @Min(1)
    @Transform(({ value }) => parseInt(value, 10))
    page?: number;

    @ApiPropertyOptional({ description: 'Items per page', default: 10 })
    @IsNumber()
    @IsOptional()
    @Min(1)
    @Transform(({ value }) => parseInt(value, 10))
    limit?: number;
}

export class CreateProgramTypeDto {
    @ApiProperty({ description: 'Program type (max 2 characters)', maxLength: 2 })
    @IsString()
    @IsNotEmpty()
    @Transform(({ value }) => value?.toUpperCase?.())
    type: string;

    @ApiPropertyOptional({ description: 'Program type description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Active status', default: true })
    @IsBoolean()
    @IsOptional()
    active?: boolean;
}

export class UpdateProgramTypeDto {
    @ApiPropertyOptional({ description: 'Program type (max 2 characters)', maxLength: 2 })
    @IsString()
    @IsOptional()
    @Transform(({ value }) => value?.toUpperCase?.())
    type?: string;

    @ApiPropertyOptional({ description: 'Program type description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Active status' })
    @IsBoolean()
    @IsOptional()
    active?: boolean;
}

export class CreateProgramModeDto {
    @ApiProperty({ description: 'Program mode (max 2 characters)', maxLength: 2 })
    @IsString()
    @IsNotEmpty()
    @Transform(({ value }) => value?.toUpperCase?.())
    mode: string;

    @ApiPropertyOptional({ description: 'Program mode description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Active status', default: true })
    @IsBoolean()
    @IsOptional()
    active?: boolean;
}

export class UpdateProgramModeDto {
    @ApiPropertyOptional({ description: 'Program mode (max 2 characters)', maxLength: 2 })
    @IsString()
    @IsOptional()
    @Transform(({ value }) => value?.toUpperCase?.())
    mode?: string;

    @ApiPropertyOptional({ description: 'Program mode description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Active status' })
    @IsBoolean()
    @IsOptional()
    active?: boolean;
}
