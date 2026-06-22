import { IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PostLocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

export class CreatePostDto {
  @IsString()
  studentId!: string;

  @IsString()
  subject!: string;

  @IsString()
  level!: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  budget!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PostLocationDto)
  location?: PostLocationDto;
}
