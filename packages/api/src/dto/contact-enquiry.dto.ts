import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ContactEnquiryCategory,
  ContactEnquiryPriority,
  ContactEnquiryStatus,
} from '../schemas/contact-enquiry.schema';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreatePublicContactEnquiryDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsEnum(ContactEnquiryCategory)
  category: ContactEnquiryCategory;

  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class ContactEnquiryListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsEnum(ContactEnquiryStatus)
  status?: ContactEnquiryStatus;

  @IsOptional()
  @IsEnum(ContactEnquiryCategory)
  category?: ContactEnquiryCategory;

  @IsOptional()
  @IsEnum(ContactEnquiryPriority)
  priority?: ContactEnquiryPriority;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(['mine', 'all', 'unassigned'])
  scope?: 'mine' | 'all' | 'unassigned';
}

export class AssignContactEnquiryDto {
  @IsMongoId()
  assignedToUserId: string;
}

export class UpdateContactEnquiryDto {
  @IsOptional()
  @IsEnum(ContactEnquiryStatus)
  status?: ContactEnquiryStatus;

  @IsOptional()
  @IsEnum(ContactEnquiryPriority)
  priority?: ContactEnquiryPriority;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ContactEnquiryMessageDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(12000)
  body: string;
}

