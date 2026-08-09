import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  classId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileUrl?: string[];

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
