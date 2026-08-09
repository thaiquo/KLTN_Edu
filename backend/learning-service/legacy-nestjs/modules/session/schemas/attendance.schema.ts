import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AttendanceDocument = HydratedDocument<Attendance>;

@Schema({ timestamps: true, collection: 'attendances' })
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'Session', required: true, index: true })
  sessionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, default: false })
  present!: boolean;

  @Prop({ required: true, default: '' })
  checkinDate!: string;

  @Prop({ required: true, default: 'student' })
  type!: string;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
