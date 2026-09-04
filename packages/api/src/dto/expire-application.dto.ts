import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ExpireApplicationDto {
    @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MinLength(5, { message: 'Expiration reason must be at least 5 characters long' })
    @MaxLength(1000, { message: 'Expiration reason cannot exceed 1000 characters' })
    reason: string;
}
