import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClassRoomDocument = HydratedDocument<ClassRoom>;

@Schema({ timestamps: true, collection: 'classrooms' })
export class ClassRoom {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  tutorId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  tutorSubjectId!: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  studentIds!: Types.ObjectId[];

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '', trim: true })
  description!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Subject' }], default: [] })
  subjectIds!: Types.ObjectId[];

  @Prop({ required: true, min: 0 })
  pricePerSession!: number;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, enum: ['per_hour', 'per_session', 'per_30_days', 'per_course'] })
  priceUnit!: 'per_hour' | 'per_session' | 'per_30_days' | 'per_course';

  @Prop({ required: true, enum: ['draft', 'active', 'completed', 'cancelled'], default: 'draft', index: true })
  status!: 'draft' | 'active' | 'completed' | 'cancelled';

  @Prop({ default: 1, min: 1 })
  maxStudents!: number;

  @Prop({ default: '', trim: true })
  startDate!: string;

  @Prop({ default: '', trim: true })
  endDate!: string;

  @Prop({ type: Object, default: {} })
  schedule!: Record<string, unknown>;

  @Prop({ default: '' })
  contractAddress!: string;
}

export const ClassRoomSchema = SchemaFactory.createForClass(ClassRoom);
