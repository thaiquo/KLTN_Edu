import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WalletDocument = HydratedDocument<Wallet>;

@Schema({ timestamps: true, collection: 'wallets' })
export class Wallet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  network!: string;

  @Prop({ required: true, unique: true, trim: true })
  address!: string;

  @Prop({ required: true, min: 0, default: 0 })
  balance!: number;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
