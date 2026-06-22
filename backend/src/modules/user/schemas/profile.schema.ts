import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProfileDocument = HydratedDocument<Profile>;

@Schema({ timestamps: true, collection: 'profiles' })
export class Profile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '', trim: true })
  address!: string;

  @Prop({ default: '', trim: true })
  gender!: string;

  @Prop({ default: '', trim: true })
  phone!: string;

  @Prop({ default: '' })
  avatar!: string;

  @Prop({ default: '', trim: true })
  dateOfBirth!: string;

  @Prop({ default: '' })
  bio!: string;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
