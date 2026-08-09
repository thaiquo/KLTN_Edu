import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AssignmentDocument = HydratedDocument<Assignment>;

@Schema({ timestamps: true, collection: 'assignments' })
export class Assignment {
  @Prop({ type: Types.ObjectId, ref: 'ClassRoom', required: true, index: true })
  classId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, default: '' })
  description!: string;

  @Prop({ type: [String], default: [] })
  fileUrl!: string[];

  @Prop({ required: true, default: '' })
  dueDate!: string;

  @Prop({ required: true, default: '' })
  content!: string;
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
