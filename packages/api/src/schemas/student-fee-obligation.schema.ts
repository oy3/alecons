import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentFeeObligationDocument = StudentFeeObligation & Document;

@Schema({ timestamps: true, optimisticConcurrency: true })
export class StudentFeeObligation {
  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
  academicSessionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment', required: true, index: true })
  paymentId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amountSnapshot: number;

  @Prop({ required: true, enum: ['new', 'returning'] })
  studentGroupSnapshot: string;

  @Prop({ required: true, enum: ['due', 'paid', 'waived', 'cancelled'], default: 'due', index: true })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'StudentPayment' })
  settledByPaymentId?: Types.ObjectId;

  @Prop()
  settledAt?: Date;

  @Prop({ maxlength: 500 })
  note?: string;
}

export const StudentFeeObligationSchema = SchemaFactory.createForClass(StudentFeeObligation);
StudentFeeObligationSchema.index(
  { studentId: 1, academicSessionId: 1, paymentId: 1 },
  { unique: true, name: 'uniq_student_session_fee_obligation' },
);
StudentFeeObligationSchema.index({ academicSessionId: 1, status: 1, paymentId: 1 });

