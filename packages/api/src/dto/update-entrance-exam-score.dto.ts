import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class UpdateEntranceExamScoreDto {
    @IsNumber()
    @Min(0)
    @Max(100)
    score: number;

    @IsBoolean()
    passed: boolean;
}
