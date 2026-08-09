import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EnrollmentDocument = HydratedDocument<Enrollment>;

@Schema({ timestamps: true, collection: 'enrollments' })
export class Enrollment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ClassRoom', required: true, index: true })
  classRoomId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ClassRoom', required: true, index: true })
  classId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId!: Types.ObjectId;

  @Prop({ required: true, default: () => new Date().toISOString() })
  joinDate!: string;

  @Prop({ type: String, required: true, enum: ['active', 'pending', 'cancelled', 'completed'], default: 'active', index: true })
  status!: 'active' | 'pending' | 'cancelled' | 'completed';
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);
