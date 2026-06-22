import { IsArray, IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsArray()
  @IsMongoId({ each: true })
  participantIds!: string[];

  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['direct', 'class', 'support'])
  type?: 'direct' | 'class' | 'support';

  @IsOptional()
  @IsString()
  lastPreview?: string;
}
