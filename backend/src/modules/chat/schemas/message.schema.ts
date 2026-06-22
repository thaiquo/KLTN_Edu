import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  senderId!: Types.ObjectId;

  @Prop({ required: true, default: '' })
  content!: string;

  @Prop({ required: true, enum: ['text', 'image', 'file', 'system'], default: 'text' })
  type!: 'text' | 'image' | 'file' | 'system';

  @Prop({ type: [String], default: [] })
  attachmentUrls!: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  from?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  to?: Types.ObjectId;

  @Prop({ default: false })
  isRead!: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
