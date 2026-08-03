import { IsString, IsOptional, IsMongoId, IsBoolean } from 'class-validator';
import { UserRole } from '../schemas/user.schema';
import { IsEnum } from 'class-validator';

export class UpdateStaffDto {
    @IsEnum([UserRole.ADMIN, UserRole.STAFF])
    @IsOptional()
    type?: UserRole.ADMIN | UserRole.STAFF;

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