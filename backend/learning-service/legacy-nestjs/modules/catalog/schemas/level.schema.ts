import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LevelDocument = HydratedDocument<Level>;

@Schema({ timestamps: true, collection: 'levels' })
export class Level {
  @Prop({ required: true, unique: true, trim: true })
  name!: string;
}

export const LevelSchema = SchemaFactory.createForClass(Level);
