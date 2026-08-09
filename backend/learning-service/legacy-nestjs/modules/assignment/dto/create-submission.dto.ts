import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @IsString()
  assignmentId!: string;

  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileUrl?: string[];

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}
