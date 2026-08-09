import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateClassRoomDto {
  @IsString()
  tutorId!: string;

  @IsString()
  tutorSubjectId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerSession?: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @IsIn(['per_hour', 'per_session', 'per_30_days', 'per_course'])
  priceUnit!: 'per_hour' | 'per_session' | 'per_30_days' | 'per_course';

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'active', 'completed', 'cancelled'])
  status?: 'draft' | 'active' | 'completed' | 'cancelled';

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxStudents?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  schedule?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  contractAddress?: string;
}
