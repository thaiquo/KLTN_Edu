import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export type UserRoleName = 'student' | 'tutor' | 'admin';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, trim: true, match: /^0\d{9}$/ })
  phone!: string;

  @Prop({ required: true, select: false })
  password!: string;

  @Prop({ type: String, required: true, enum: ['student', 'tutor', 'admin'], default: 'student' })
  role!: UserRoleName;

  @Prop({ type: String, required: true, enum: ['student', 'tutor', 'admin'], default: 'student' })
  currentRole!: UserRoleName;

  @Prop({ default: false })
  isVerified!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
