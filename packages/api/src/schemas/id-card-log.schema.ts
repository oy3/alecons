import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IdCardLogDocument = IdCardLog & Document;

export enum IdCardEntityType {
    STUDENT = 'student',
    STAFF = 'staff',
}

/**
 * Tracks the ID card generation history for each student or staff member.
 * One document per entity — upserted on each generation.
 */
@Schema({ timestamps: true })
export class IdCardLog {
    /** The user whose card was generated (ref: User) */
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    /** Whether this is a student or staff card */
    @Prop({ required: true, enum: IdCardEntityType })
    entityType: IdCardEntityType;

    /** The Student or Staff document id */
    @Prop({ type: Types.ObjectId, required: true, index: true })
    entityId: Types.ObjectId;

    /** Staff user who triggered the generation */
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    generatedBy: Types.ObjectId;

    /** When the card was first generated */
    @Prop({ required: true })
    firstGeneratedAt: Date;

    /** When the card was most recently generated */
    @Prop({ required: true })
    lastGeneratedAt: Date;

    /** Total number of times the card has been generated */
    @Prop({ default: 1 })
    generationCount: number;
}

export const IdCardLogSchema = SchemaFactory.createForClass(IdCardLog);

// Unique index: one log document per entity
IdCardLogSchema.index({ entityId: 1, entityType: 1 }, { unique: true });
