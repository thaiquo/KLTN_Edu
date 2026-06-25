import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuthUserDocument = HydratedDocument<AuthUser>;

export type UserRoleName = 'student' | 'tutor' | 'admin';

@Schema({ timestamps: true, collection: 'users' })
export class AuthUser {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ type: String, required: true, enum: ['student', 'tutor', 'admin'], default: 'student' })
  role!: UserRoleName;

  @Prop({ type: String, required: true, enum: ['student', 'tutor', 'admin'], default: 'student' })
  currentRole!: UserRoleName;

  @Prop({ default: false })
  isVerified!: boolean;
}

export const AuthUserSchema = SchemaFactory.createForClass(AuthUser);
