import { IsArray, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsMongoId()
  conversationId!: string;

  @IsMongoId()
  senderId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'image', 'file', 'system'])
  type?: 'text' | 'image' | 'file' | 'system';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];

  @IsOptional()
  @IsMongoId()
  from?: string;

  @IsOptional()
  @IsMongoId()
  to?: string;
}
