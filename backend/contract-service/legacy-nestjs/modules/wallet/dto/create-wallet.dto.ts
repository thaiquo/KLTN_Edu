import { IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateWalletDto {
  @IsMongoId()
  userId!: string;

  @IsString()
  network!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  balance?: number;
}
