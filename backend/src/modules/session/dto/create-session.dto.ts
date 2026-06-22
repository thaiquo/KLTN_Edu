import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  classId!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsIn(['scheduled', 'completed'])
  status?: 'scheduled' | 'completed';
}
