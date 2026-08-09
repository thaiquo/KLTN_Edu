import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentEntityDocument = HydratedDocument<DocumentEntity>;

@Schema({ timestamps: true, collection: 'documents' })
export class DocumentEntity {
  @Prop({ type: Types.ObjectId, ref: 'ClassRoom', required: true, index: true })
  classId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: [String], default: [] })
  fileUrl!: string[];

  @Prop({ default: '', trim: true })
  description!: string;
}

export const DocumentEntitySchema = SchemaFactory.createForClass(DocumentEntity);
