import { Transform, Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import {
    AcademicResultAttemptType,
    AcademicResultSpecialStatus,
} from '../schemas/academic-result.schema';
import { GradeScaleStatus } from '../schemas/grade-scale-version.schema';

export class GradeBandDto {
    @IsString()
    @MaxLength(4)
    letter: string;

    @IsNumber()
    @Min(0)
    @Max(100)
    minScore: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    maxScore: number;

    @IsNumber()
    @Min(0)
    gradePoint: number;

    @IsBoolean()
    isPass: boolean;

    @IsInt()
    @Min(1)
    displayOrder: number;
}

export class CreateGradeScaleDto {
    @IsString()
    @MaxLength(120)
    name: string;

    @IsNumber()
    @Min(0.1)
    @Max(10)
    gpaScale: number;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => GradeBandDto)
    bands: GradeBandDto[];

    @IsOptional()
    @IsEnum(GradeScaleStatus)
    status?: GradeScaleStatus;
}

export class UpdateGradeScaleStatusDto {
    @IsEnum(GradeScaleStatus)
    status: GradeScaleStatus.ACTIVE | GradeScaleStatus.RETIRED;
}

export class ComponentScoreInputDto {
    @IsInt()
    @Min(1)
    componentOrder: number;

    @IsOptional()
    @Transform(({ value }) => value === '' || value === null ? undefined : Number(value))
    @IsNumber()
    @Min(0)
    rawMark?: number;

    @IsOptional()
    @IsBoolean()
    absent?: boolean;
}

export class StudentScoreInputDto {
    @IsMongoId()
    studentId: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    version?: number;

    @IsOptional()
    @IsEnum(AcademicResultSpecialStatus)
    specialStatus?: AcademicResultSpecialStatus;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ComponentScoreInputDto)
    componentScores: ComponentScoreInputDto[];
}

export class SaveAcademicScoresDto {
    @IsOptional()
    @IsEnum(AcademicResultAttemptType)
    attemptType?: AcademicResultAttemptType;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => StudentScoreInputDto)
    scores: StudentScoreInputDto[];
}

export class AcademicResultContextDto {
    @IsMongoId()
    programCourseId: string;

    @IsMongoId()
    academicSessionId: string;

    @IsEnum(AcademicResultAttemptType)
    attemptType: AcademicResultAttemptType;

    @IsOptional()
    @IsMongoId()
    departmentId?: string;
}

export class ReviewAcademicResultContextDto {
    @ValidateNested()
    @Type(() => AcademicResultContextDto)
    context: AcademicResultContextDto;

    @IsBoolean()
    approved: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    comment?: string;
}

export class CreateAcademicResultAttemptDto {
    @IsMongoId()
    studentId: string;

    @IsMongoId()
    programCourseId: string;

    @IsEnum(AcademicResultAttemptType)
    attemptType: AcademicResultAttemptType;
}

export class AmendPublishedAcademicResultDto {
    @IsInt()
    @Min(0)
    version: number;

    @IsString()
    @MaxLength(2000)
    reason: string;

    @IsOptional()
    @IsEnum(AcademicResultSpecialStatus)
    specialStatus?: AcademicResultSpecialStatus;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ComponentScoreInputDto)
    componentScores: ComponentScoreInputDto[];
}
