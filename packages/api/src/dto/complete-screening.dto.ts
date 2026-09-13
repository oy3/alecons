import { IsBoolean, IsOptional } from 'class-validator';

export class CompleteScreeningDto {
    @IsOptional()
    @IsBoolean()
    bypassSchedule?: boolean;
}
