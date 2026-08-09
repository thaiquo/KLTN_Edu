import { IsBoolean, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateContractDto {
  @IsMongoId()
  classId!: string;

  @IsString()
  contractAddress!: string;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'active', 'released', 'cancelled'])
  status?: 'draft' | 'active' | 'released' | 'cancelled';

  @IsOptional()
  @IsNumber()
  @Min(0)
  platformFeePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  balance?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
