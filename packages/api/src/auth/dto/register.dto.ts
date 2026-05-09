import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const normalizeLowercaseText = ({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().replace(/\s+/g, ' ').toLowerCase();
};

const normalizeEmail = ({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().replace(/\s+/g, '').toLowerCase();
};

const normalizePhone = ({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.replace(/\s+/g, '').trim();
};

export class RegisterDto {
    @ApiProperty({ example: 'john.doe@example.com' })
    @Transform(normalizeEmail)
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({ example: 'John' })
    @Transform(normalizeLowercaseText)
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({ example: 'Michael', required: false })
    @Transform(normalizeLowercaseText)
    @IsString()
    @IsOptional()
    otherName?: string;

    @ApiProperty({ example: 'Doe' })
    @Transform(normalizeLowercaseText)
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({ example: '08012345678', required: false })
    @Transform(normalizePhone)
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
    @IsOptional()
    programTypeId?: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439012' })
    @IsMongoId()
    @IsOptional()
    programModeId?: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439013' })
    @IsMongoId()
    @IsNotEmpty()
    programId: string;
}
