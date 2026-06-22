import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true, collection: 'sessions' })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'ClassRoom', required: true, index: true })
  classId!: Types.ObjectId;

  @Prop({ required: true })
  date!: string;

  @Prop({ required: true, default: '' })
  startTime!: string;

  @Prop({ required: true, default: '' })
  endTime!: string;

  @Prop({ required: true, default: '' })
  link!: string;

  @Prop({ required: true, enum: ['scheduled', 'completed'], default: 'scheduled' })
  status!: 'scheduled' | 'completed';
}

export const SessionSchema = SchemaFactory.createForClass(Session);
