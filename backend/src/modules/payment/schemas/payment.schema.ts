import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Contract', required: true, index: true })
  contractId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Session', required: true, index: true })
  sessionId!: Types.ObjectId;

  @Prop({ required: true, default: '' })
  fromWallet!: string;

  @Prop({ required: true, default: '' })
  toWallet!: string;

  @Prop({ required: true, default: 0 })
  amount!: number;

  @Prop({ required: true, default: '' })
  transactionHash!: string;

  @Prop({ required: true, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending', index: true })
  status!: 'pending' | 'paid' | 'failed' | 'refunded';

  @Prop({ required: true, default: '' })
  txHash!: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
