import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubmissionDocument = HydratedDocument<Submission>;

@Schema({ timestamps: true, collection: 'submissions' })
export class Submission {
  @Prop({ type: Types.ObjectId, ref: 'Assignment', required: true, index: true })
  assignmentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId!: Types.ObjectId;

  @Prop({ required: true, default: '' })
  content!: string;

  @Prop({ type: [String], default: [] })
  fileUrl!: string[];

  @Prop({ required: true, default: 0 })
  score!: number;

  @Prop({ required: true, default: '' })
  feedback!: string;
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);
