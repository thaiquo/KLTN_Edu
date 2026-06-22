import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MatchRequestDocument = HydratedDocument<MatchRequest>;

@Schema({ timestamps: true, collection: 'match_requests' })
export class MatchRequest {
  @Prop({ type: Types.ObjectId, ref: 'PostEntity', required: true, index: true })
  postId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  tutorId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  from!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  to?: Types.ObjectId;

  @Prop({ required: true, enum: ['student_to_tutor', 'tutor_to_student'], default: 'tutor_to_student' })
  type!: 'student_to_tutor' | 'tutor_to_student';

  @Prop({ required: true, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending' })
  status!: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

export const MatchRequestSchema = SchemaFactory.createForClass(MatchRequest);
