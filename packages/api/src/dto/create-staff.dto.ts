import { IsEmail, IsNotEmpty, IsString, IsOptional, IsMongoId, IsBoolean } from 'class-validator';

export class CreateStaffDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsOptional()
    otherName?: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsNotEmpty()
    department: string;

    @IsString()
    @IsNotEmpty()
    position: string;

    @IsMongoId()
    @IsNotEmpty()
    roleId: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean = true;
}