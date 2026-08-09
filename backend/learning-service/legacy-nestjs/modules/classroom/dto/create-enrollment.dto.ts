import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateEnrollmentDto {
  @IsString()
  classId!: string;

  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  classRoomId?: string;

  @IsOptional()
  @IsString()
  joinDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'pending', 'cancelled', 'completed'])
  status?: 'active' | 'pending' | 'cancelled' | 'completed';
}
