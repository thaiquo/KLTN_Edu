import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsMimeType, IsNotEmpty,
  IsNumber, IsOptional, IsString, Matches, Max, Min, ValidateNested
} from 'class-validator';

export class TutorAvailabilityDto {
  @IsInt() @Min(1) @Max(7) dayOfWeek!: number;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
}

export class SubjectEvidenceDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() issuer!: string;
  @IsDateString() issueDate!: string;
  @IsOptional() @IsDateString() expiryDate?: string | null;
  @IsOptional() @IsString() description?: string;
  @IsString() @IsNotEmpty() fileKey!: string;
  @IsString() @IsNotEmpty() originalFileName!: string;
  @IsMimeType() fileType!: string;
  @IsInt() @Min(1) fileSize!: number;
}

export class TutorSubjectDto {
  @IsString() @IsNotEmpty() levelGroupId!: string;
  @IsString() @IsNotEmpty() subjectId!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) teachingLevelIds!: string[];
  @IsNumber() @Min(0) yearsOfExperience!: number;
  @IsNumber() @Min(1) minPrice!: number;
  @IsNumber() @Min(1) maxPrice!: number;
  @IsString() @IsIn(['per_hour', 'per_session', 'per_30_days', 'per_course'])
  priceUnit!: 'per_hour' | 'per_session' | 'per_30_days' | 'per_course';
  @IsOptional() @IsInt() @Min(1) durationDays?: number | null;
  @IsInt() @Min(1) sessionsPerPeriod!: number;
  @IsInt() @Min(1) minutesPerSession!: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SubjectEvidenceDto)
  evidences!: SubjectEvidenceDto[];
}

export class CreateTutorProfileDto {
  @IsString() @IsNotEmpty() bio!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TutorAvailabilityDto)
  weeklyAvailability!: TutorAvailabilityDto[];
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TutorSubjectDto)
  teachingSubjects!: TutorSubjectDto[];
}

export class ReviewTutorItemDto {
  @IsString() @IsIn(['approved', 'rejected']) status!: 'approved' | 'rejected';
  @IsOptional() @IsString() adminNote?: string;
}
