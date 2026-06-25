import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ type: [Types.ObjectId], ref: 'User', required: true, default: [] })
  participantIds!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'ClassRoom', required: false, index: true })
  classId?: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['direct', 'class', 'support'], default: 'direct', index: true })
  type!: 'direct' | 'class' | 'support';

  @Prop({ default: '', trim: true })
  lastPreview!: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
