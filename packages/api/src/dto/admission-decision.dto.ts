import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class AdmissionDecisionDto {
    @IsIn(['admitted', 'rejected'])
    decision: 'admitted' | 'rejected';

    @IsOptional()
    @IsBoolean()
    sendProvisionalOffer?: boolean;

    @IsOptional()
    @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MaxLength(1000)
    reason?: string;

    @IsOptional()
    @IsString()
    screeningDate?: string;

    @IsOptional()
    @IsString()
    screeningTime?: string;

    @IsOptional()
    @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MaxLength(500)
    venue?: string;
}
