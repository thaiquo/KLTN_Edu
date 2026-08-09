import { IsArray, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  @IsMongoId()
  classId!: string;

  @IsMongoId()
  ownerId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileUrl?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
