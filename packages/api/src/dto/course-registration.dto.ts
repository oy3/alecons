import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';

const parseOptionalInt = ({ value }) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    return parseInt(value, 10);
};

export class UpsertCourseRegistrationDraftDto {
    @ApiPropertyOptional({ description: 'Level to save draft for', minimum: 1 })
    @Transform(parseOptionalInt)
    @IsOptional()
    @IsInt()
    @Min(1)
    level?: number;

    @ApiProperty({ description: 'Semester to save draft for', enum: [1, 2] })
    @Transform(({ value }) => parseInt(value, 10))
    @IsIn([1, 2])
    semester: number;

    @ApiPropertyOptional({
        description: 'Selected program course assignments',
        type: [String],
        default: [],
    })
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsMongoId({ each: true })
    items?: string[];
}

export class SubmitCourseRegistrationDto {
    @ApiPropertyOptional({ description: 'Level to submit registration for', minimum: 1 })
    @Transform(parseOptionalInt)
    @IsOptional()
    @IsInt()
    @Min(1)
    level?: number;

    @ApiProperty({ description: 'Semester to submit registration for', enum: [1, 2] })
    @Transform(({ value }) => parseInt(value, 10))
    @IsIn([1, 2])
    semester: number;

    @ApiProperty({
        description: 'Selected program course assignments',
        type: [String],
    })
    @IsArray()
    @ArrayUnique()
    @IsMongoId({ each: true })
    items: string[];
}
