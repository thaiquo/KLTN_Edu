import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateMatchRequestDto {
  @IsString()
  postId!: string;

  @IsString()
  tutorId!: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  @IsIn(['student_to_tutor', 'tutor_to_student'])
  type?: 'student_to_tutor' | 'tutor_to_student';

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'accepted', 'rejected', 'cancelled'])
  status?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}
