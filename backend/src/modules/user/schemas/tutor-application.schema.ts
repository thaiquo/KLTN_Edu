import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  ApplicationStatus,
  TutorAvailabilitySchema,
  TutorSubjectSchema
} from './tutor-profile.schema';

export type TutorApplicationRecordDocument = HydratedDocument<TutorApplicationRecord>;
export type TutorApplicationRecordStatus = ApplicationStatus | 'withdrawn';

@Schema({ timestamps: true, collection: 'tutor_applications' })
export class TutorApplicationRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ default: '', trim: true })
  bio!: string;

  @Prop({ type: [TutorAvailabilitySchema], default: [] })
  weeklyAvailability!: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;

  @Prop({ type: [TutorSubjectSchema], default: [] })
  teachingSubjects!: any[];

  @Prop({ type: String, required: true, enum: ['pending', 'approved', 'rejected', 'withdrawn'], default: 'pending', index: true })
  status!: TutorApplicationRecordStatus;

  @Prop({ default: '', trim: true })
  adminNote!: string;

  @Prop({ required: true, default: 1, min: 1 })
  revision!: number;

  @Prop({ type: Date, default: Date.now })
  submittedAt!: Date;

  @Prop({ type: Date, default: null })
  reviewedAt!: Date | null;

  @Prop({ type: Date, default: null })
  withdrawnAt!: Date | null;

  @Prop({ type: String, index: true, sparse: true })
  legacyProfileId?: string;
}

export const TutorApplicationRecordSchema = SchemaFactory.createForClass(TutorApplicationRecord);
