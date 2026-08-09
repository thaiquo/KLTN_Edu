import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserRoleDocument = HydratedDocument<UserRole>;

@Schema({ timestamps: true, collection: 'user_roles' })
export class UserRole {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['student', 'tutor', 'admin'], index: true })
  role!: 'student' | 'tutor' | 'admin';
}

export const UserRoleSchema = SchemaFactory.createForClass(UserRole);
