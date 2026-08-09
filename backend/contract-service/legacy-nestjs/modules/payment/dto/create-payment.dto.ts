import { IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  contractId!: string;

  @IsMongoId()
  sessionId!: string;

  @IsOptional()
  @IsString()
  fromWallet?: string;

  @IsOptional()
  @IsString()
  toWallet?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsIn(['pending', 'paid', 'failed', 'refunded'])
  status?: 'pending' | 'paid' | 'failed' | 'refunded';

  @IsOptional()
  @IsString()
  transactionHash?: string;

  @IsOptional()
  @IsString()
  txHash?: string;
}
