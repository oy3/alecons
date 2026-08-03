import { Transform, Type } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
    Max,
    Min,
} from 'class-validator';
import { ProgramCourseCategory } from '../schemas/program-course.schema';

export class ProgramCourseAssessmentComponentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    title: string;

    @IsNumber()
    @Min(0.0001)
    maximumMark: number;

    @IsNumber()
    @Min(0.0001)
    @Max(100)
    weightPercent: number;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    componentType?: string;

    @IsInt()
    @Min(1)
    displayOrder: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @IsOptional()
    assessmentDate?: Date;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @IsBoolean()
    mandatory?: boolean;

    @IsOptional()
    @IsBoolean()
    absenceAllowed?: boolean;
}

export class CreateCourseDto {
    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

}

export class UpdateCourseDto {
    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

}

export class QueryCoursesDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    limit?: number;
}

export class CreateProgramCourseDto {
    @IsMongoId()
    @IsNotEmpty()
    courseId: string;

    @IsMongoId()
    @IsNotEmpty()
    programId: string;

    @IsNumber()
    @Min(1)
    units: number;

    @IsNumber()
    @Min(1)
    hours: number;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsMongoId({ each: true })
    lecturerIds?: string[];

    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    level: number;

    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @IsIn([1, 2])
    semester: number;

    @IsString()
    @IsIn(Object.values(ProgramCourseCategory))
    category: ProgramCourseCategory;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProgramCourseAssessmentComponentDto)
    assessmentComponents: ProgramCourseAssessmentComponentDto[];
}

export class UpdateProgramCourseDto {
    @IsOptional()
    @IsMongoId()
    courseId?: string;

    @IsOptional()
    @IsMongoId()
    programId?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    units?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    hours?: number;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsMongoId({ each: true })
    lecturerIds?: string[];

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    level?: number;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @IsIn([1, 2])
    semester?: number;

    @IsOptional()
    @IsString()
    @IsIn(Object.values(ProgramCourseCategory))
    category?: ProgramCourseCategory;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProgramCourseAssessmentComponentDto)
    assessmentComponents?: ProgramCourseAssessmentComponentDto[];
}

export class QueryProgramCoursesDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsMongoId()
    programId?: string;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    level?: number;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @IsIn([1, 2])
    semester?: number;

    @IsOptional()
    @IsString()
    @IsIn(Object.values(ProgramCourseCategory))
    category?: ProgramCourseCategory;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    limit?: number;
}
