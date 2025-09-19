import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: 'john.doe@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({ example: 'John' })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({ example: 'Michael', required: false })
    @IsString()
    @IsOptional()
    otherName?: string;

    @ApiProperty({ example: 'Doe' })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({ example: '08012345678', required: false })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiProperty({ example: '1995-01-15', required: false })
    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;

    @ApiProperty({ example: 'male', enum: ['male', 'female', 'other', 'prefer_not_to_say'], required: false })
    @IsString()
    @IsOptional()
    gender?: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @IsMongoId()
    @IsNotEmpty()
    programTypeId: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439012' })
    @IsMongoId()
    @IsNotEmpty()
    programModeId: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439013' })
    @IsMongoId()
    @IsNotEmpty()
    programId: string;
}
