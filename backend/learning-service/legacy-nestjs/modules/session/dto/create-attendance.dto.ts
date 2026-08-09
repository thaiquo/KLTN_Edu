import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
  @IsString()
  sessionId!: string;

  @IsString()
  userId!: string;

  @IsBoolean()
  present!: boolean;

  @IsOptional()
  @IsString()
  checkinDate?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
