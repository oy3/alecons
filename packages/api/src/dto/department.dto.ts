import { IsString, IsBoolean, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateDepartmentDto {
    @IsString()
    @MinLength(1)
    name: string;

    @IsString()
    @MinLength(2)
    @MaxLength(3)
    code: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class UpdateDepartmentDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    name?: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(3)
    code?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class QueryDepartmentsDto {
    @IsOptional()
    @IsString()
    search?: string;

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
    sortOrder?: 'asc' | 'desc';

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}