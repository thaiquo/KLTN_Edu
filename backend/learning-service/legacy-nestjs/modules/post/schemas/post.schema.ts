import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<PostEntity>;

@Schema({ timestamps: true, collection: 'posts' })
export class PostEntity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  subject!: string;

  @Prop({ required: true, trim: true })
  level!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, min: 0 })
  budget!: number;

  @Prop({
    type: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 }
    },
    default: { lat: 0, lng: 0 }
  })
  location!: { lat: number; lng: number };
}

export const PostSchema = SchemaFactory.createForClass(PostEntity);
