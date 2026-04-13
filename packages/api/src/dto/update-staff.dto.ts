import { IsString, IsOptional, IsMongoId, IsBoolean } from 'class-validator';

export class UpdateStaffDto {
    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    otherName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    department?: string;

    @IsString()
    @IsOptional()
    position?: string;

    @IsMongoId()
    @IsOptional()
    roleId?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}