import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

const RELATIONSHIPS = [
  'father', 'mother', 'uncle', 'aunt', 'brother', 'sister',
  'grandfather', 'grandmother', 'other_blood_relative',
] as const;

class DraftTenantDetailsDto {
  @IsOptional() @IsString() @MaxLength(160) tenantName?: string;
  @IsOptional() @IsString() @MaxLength(180) courseOfStudy?: string;
  @IsOptional() @IsString() @MaxLength(500) residentialAddress?: string;
  @IsOptional() @IsString() @MaxLength(30) phoneNumber?: string;
}

class DraftParentDetailsDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phoneNumber?: string;
}

class DraftGuarantorDetailsDto extends DraftParentDetailsDto {
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(120) occupation?: string;
  @IsOptional() @IsString() @IsIn(RELATIONSHIPS) relationship?: string;
}

export class SaveInternalAccommodationAgreementDraftDto {
  @IsOptional() @ValidateNested() @Type(() => DraftTenantDetailsDto)
  personalInfo?: DraftTenantDetailsDto;

  @IsOptional() @ValidateNested() @Type(() => DraftParentDetailsDto)
  parentInfo?: DraftParentDetailsDto;

  @IsOptional() @ValidateNested() @Type(() => DraftGuarantorDetailsDto)
  guarantorInfo?: DraftGuarantorDetailsDto;
}

class InternalTenantDetailsDto {
  @IsString() @IsNotEmpty() @MaxLength(160) tenantName: string;
  @IsString() @IsNotEmpty() @MaxLength(180) courseOfStudy: string;
  @IsString() @IsNotEmpty() @MaxLength(500) residentialAddress: string;
  @IsString() @IsNotEmpty() @MaxLength(30) phoneNumber: string;
}

class ParentDetailsDto {
  @IsString() @IsNotEmpty() @MaxLength(160) name: string;
  @IsString() @IsNotEmpty() @MaxLength(30) phoneNumber: string;
}

class GuarantorDetailsDto extends ParentDetailsDto {
  @IsString() @IsNotEmpty() @MaxLength(500) address: string;
  @IsString() @IsNotEmpty() @MaxLength(120) occupation: string;
  @IsString() @IsIn(RELATIONSHIPS) relationship: string;
}

class AgreementAcceptanceDto {
  @IsBoolean() agreedToTerms: boolean;
}

export class SubmitInternalAccommodationAgreementDto {
  @ValidateNested() @Type(() => InternalTenantDetailsDto)
  personalInfo: InternalTenantDetailsDto;

  @ValidateNested() @Type(() => ParentDetailsDto)
  parentInfo: ParentDetailsDto;

  @ValidateNested() @Type(() => GuarantorDetailsDto)
  guarantorInfo: GuarantorDetailsDto;

  @ValidateNested() @Type(() => AgreementAcceptanceDto)
  agreementTerms: AgreementAcceptanceDto;
}
