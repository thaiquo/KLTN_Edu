import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScheduleDocument = HydratedDocument<Schedule>;

@Schema({ timestamps: true, collection: 'schedules' })
export class Schedule {
  @Prop({ type: Types.ObjectId, ref: 'TutorProfile', required: true, index: true })
  tutorProfileId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  dayOfWeek!: string;

  @Prop({ required: true, trim: true })
  startTime!: string;

  @Prop({ required: true, trim: true })
  endTime!: string;

  @Prop({ default: true })
  isAvailable!: boolean;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
