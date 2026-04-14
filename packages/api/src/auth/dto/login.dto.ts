import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const normalizeEmail = ({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().replace(/\s+/g, '').toLowerCase();
};

export class LoginDto {
    @ApiProperty({ example: 'john.doe@example.com' })
    @Transform(normalizeEmail)
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    @IsNotEmpty()
    password: string;
}
