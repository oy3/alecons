import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class StartExternalAccommodationDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName: string;
  @IsString() @IsOptional() @MaxLength(100) otherName?: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName: string;
  @IsString() @IsNotEmpty() @MaxLength(30) phone: string;
}

export class CompleteExternalAccommodationDto {
  @IsString() @IsNotEmpty() @MaxLength(80) category: string = "pre_degree";
  @IsIn(["male", "female"]) gender: string;
  @IsDateString() dob: string;
  @IsString() @IsNotEmpty() @MaxLength(500) homeAddress: string;
}

export class SignExternalTenancyAgreementDto {
  @IsString() @IsNotEmpty() @MaxLength(150) parentName: string;
  @IsString() @IsNotEmpty() @MaxLength(30) parentPhone: string;
  @IsString() @IsNotEmpty() @MaxLength(150) guarantorName: string;
  @IsString() @IsNotEmpty() @MaxLength(30) guarantorPhone: string;
  @IsString() @IsNotEmpty() @MaxLength(500) guarantorAddress: string;
  @IsString() @IsNotEmpty() @MaxLength(120) guarantorOccupation: string;
  @IsIn([
    "father",
    "mother",
    "uncle",
    "aunt",
    "brother",
    "sister",
    "grandfather",
    "grandmother",
    "other_blood_relative",
  ])
  guarantorRelationship: string;
  @IsBoolean() agreedToTerms: boolean;
}

export class CreateHostelDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsIn(["male", "female"]) gender: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class CreateHostelBlockDto {
  @IsMongoId() hostelId: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name: string;
  @IsIn(["internal", "external"]) residentType: string;
  @Type(() => Number) @IsInt() @Min(1) allocationOrder: number;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class CreateHostelRoomDto {
  @IsMongoId() blockId: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) capacity: number;
  @Type(() => Number) @IsInt() @Min(1) allocationOrder: number;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class UpdateHostelDto {
  @IsString() @IsNotEmpty() @IsOptional() @MaxLength(120) name?: string;
  @IsIn(["male", "female"]) @IsOptional() gender?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
}

export class UpdateHostelBlockDto {
  @IsString() @IsNotEmpty() @IsOptional() @MaxLength(80) name?: string;
  @IsIn(["internal", "external"]) @IsOptional() residentType?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() allocationOrder?: number;
}

export class UpdateHostelRoomDto {
  @IsString() @IsNotEmpty() @IsOptional() @MaxLength(80) name?: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  capacity?: number;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() allocationOrder?: number;
}

export class ManualAllocationDto {
  @IsMongoId() roomId: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() slotNumber?: number;
  @IsString() @IsOptional() @MaxLength(500) note?: string;
}

export class UpdateAccommodationInventoryDto {
  @IsBoolean() active: boolean;
}
