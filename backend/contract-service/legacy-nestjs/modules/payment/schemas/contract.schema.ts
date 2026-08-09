import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContractDocument = HydratedDocument<Contract>;

@Schema({ timestamps: true, collection: 'contracts' })
export class Contract {
  @Prop({ type: Types.ObjectId, ref: 'ClassRoom', required: true, unique: true, index: true })
  classId!: Types.ObjectId;

  @Prop({ required: true, default: '' })
  contractAddress!: string;

  @Prop({ required: true, default: '' })
  network!: string;

  @Prop({ type: String, required: true, enum: ['draft', 'active', 'released', 'cancelled'], default: 'draft', index: true })
  status!: 'draft' | 'active' | 'released' | 'cancelled';

  @Prop({ required: true, min: 0, default: 10 })
  platformFeePercent!: number;

  @Prop({ required: true, default: 0 })
  balance!: number;

  @Prop({ required: true, default: true })
  isActive!: boolean;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);
