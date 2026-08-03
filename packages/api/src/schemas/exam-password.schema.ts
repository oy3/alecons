import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExamPasswordDocument = ExamPassword & Document;

@Schema({
  timestamps: true,
  collection: 'examPasswords'
})
export class ExamPassword {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId;

  @Prop({ required: true })
  hashedPassword: string; // Hashed using bcrypt

  @Prop({ trim: true, maxlength: 100 })
  label: string; // Optional label for the password (e.g., "Group A", "Morning Session")

  @Prop({ default: 0 })
  usageCount: number; // Track how many times this password was used

  @Prop({ default: null })
  usageLimit: number; // Optional limit on how many times this password can be used

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  usedBy: Types.ObjectId[]; // Track which users used this password
}

export const ExamPasswordSchema = SchemaFactory.createForClass(ExamPassword);

// Indexes for performance
ExamPasswordSchema.index({ examId: 1, isActive: 1 });
ExamPasswordSchema.index({ expiresAt: 1 });
ExamPasswordSchema.index({ examId: 1, expiresAt: 1, isActive: 1 });