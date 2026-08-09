import { IsBoolean, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
  @IsMongoId()
  userId!: string;

  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
