import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubjectDocument = HydratedDocument<Subject>;

@Schema({ timestamps: true, collection: 'subjects' })
export class Subject {
  @Prop({ required: true, unique: true, trim: true })
  name!: string;

  @Prop({ default: '', trim: true })
  description!: string;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);
