import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CertificateDocument = HydratedDocument<Certificate>;

@Schema({ timestamps: true, collection: 'certificates' })
export class Certificate {
  @Prop({ type: Types.ObjectId, ref: 'TutorProfile', required: true, index: true })
  tutorProfileId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ default: '', trim: true })
  issuer!: string;

  @Prop({ default: '', trim: true })
  issueDate!: string;

  @Prop({ default: '' })
  fileUrl!: string;
}

export const CertificateSchema = SchemaFactory.createForClass(Certificate);
