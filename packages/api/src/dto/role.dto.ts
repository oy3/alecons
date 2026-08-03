import { IsString, IsArray, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class CreateRoleDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsArray()
    modules: string[];

    @IsObject()
    permissions: Record<string, string[]>;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class UpdateRoleDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsArray()
    modules?: string[];

    @IsOptional()
    @IsObject()
    permissions?: Record<string, string[]>;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class UpdateRoleStatusDto {
    @IsBoolean()
    active: boolean;
}
