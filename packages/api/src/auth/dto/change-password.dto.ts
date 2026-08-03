import { IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({
        description: 'Current password',
        example: 'currentPassword123'
    })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @ApiProperty({
        description: 'New password (minimum 8 characters, must contain at least one uppercase letter, one lowercase letter, one number, and one special character)',
        example: 'NewPassword123!'
    })
    @IsString()
    @MinLength(8, { message: 'New password must be at least 8 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]).{8,}$/, {
        message: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*()_+-=[]{};\':"|,.<>?)'
    })
    newPassword: string;
}