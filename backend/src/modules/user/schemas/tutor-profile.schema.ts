import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type PriceUnit = 'per_hour' | 'per_session' | 'per_30_days' | 'per_course';

@Schema({ _id: true })
export class TutorAvailability {
  @Prop({ required: true, min: 1, max: 7 }) dayOfWeek!: number;
  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }) startTime!: string;
  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }) endTime!: string;
}
export const TutorAvailabilitySchema = SchemaFactory.createForClass(TutorAvailability);

@Schema({ _id: true })
export class SubjectEvidence {
  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ required: true, trim: true }) issuer!: string;
  @Prop({ required: true }) issueDate!: string;
  @Prop({ default: null }) expiryDate!: string | null;
  @Prop({ default: '', trim: true }) description!: string;
  @Prop({ required: true }) fileKey!: string;
  @Prop({ required: true }) originalFileName!: string;
  @Prop({ required: true }) fileType!: string;
  @Prop({ required: true, min: 1 }) fileSize!: number;
  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  verificationStatus!: ReviewStatus;
  @Prop({ default: '', trim: true }) adminNote!: string;
}
export const SubjectEvidenceSchema = SchemaFactory.createForClass(SubjectEvidence);

@Schema({ _id: true, timestamps: true })
export class TutorSubject {
  @Prop({ required: true, trim: true }) levelGroupId!: string;
  @Prop({ required: true, trim: true }) subjectId!: string;
  @Prop({ type: [String], required: true, default: [] }) teachingLevelIds!: string[];
  @Prop({ required: true, min: 0 }) yearsOfExperience!: number;
  @Prop({ required: true, min: 1 }) minPrice!: number;
  @Prop({ required: true, min: 1 }) maxPrice!: number;
  @Prop({ required: true, enum: ['per_hour', 'per_session', 'per_30_days', 'per_course'] })
  priceUnit!: PriceUnit;
  @Prop({ default: null, min: 1 }) durationDays!: number | null;
  @Prop({ required: true, min: 1 }) sessionsPerPeriod!: number;
  @Prop({ required: true, min: 1 }) minutesPerSession!: number;
  @Prop({ type: [SubjectEvidenceSchema], default: [] }) evidences!: SubjectEvidence[];
  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  verificationStatus!: ReviewStatus;
  @Prop({ default: '', trim: true }) adminNote!: string;
}
export const TutorSubjectSchema = SchemaFactory.createForClass(TutorSubject);

export type TutorProfileDocument = HydratedDocument<TutorProfile>;

@Schema({ timestamps: true, collection: 'tutor_profiles' })
export class TutorProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;
  @Prop({ default: '', trim: true }) bio!: string;
  @Prop({ type: [TutorAvailabilitySchema], default: [] }) weeklyAvailability!: TutorAvailability[];
  @Prop({ type: [TutorSubjectSchema], default: [] }) teachingSubjects!: TutorSubject[];
  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true })
  status!: ApplicationStatus;
  @Prop({ default: '', trim: true }) adminNote!: string;
  @Prop({ default: 0 }) rating!: number;
  @Prop({ default: 0 }) totalReviews!: number;
}

export const TutorProfileSchema = SchemaFactory.createForClass(TutorProfile);
