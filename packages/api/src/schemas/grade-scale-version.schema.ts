import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GradeScaleVersionDocument = GradeScaleVersion & Document;

export enum GradeScaleStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    RETIRED = 'retired',
}

@Schema({ _id: false })
export class GradeBand {
    @Prop({ required: true, trim: true, maxlength: 4 })
    letter: string;

    @Prop({ required: true, min: 0, max: 100 })
    minScore: number;

    @Prop({ required: true, min: 0, max: 100 })
    maxScore: number;

    @Prop({ required: true, min: 0, max: 4 })
    gradePoint: number;

    @Prop({ required: true })
    isPass: boolean;

    @Prop({ required: true, min: 1 })
    displayOrder: number;
}

export const GradeBandSchema = SchemaFactory.createForClass(GradeBand);

@Schema({ timestamps: true })
export class GradeScaleVersion {
    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, min: 0.1, max: 10 })
    gpaScale: number;

    @Prop({ required: true, min: 1 })
    version: number;

    @Prop({ type: [GradeBandSchema], required: true })
    bands: GradeBand[];

    @Prop({ enum: GradeScaleStatus, default: GradeScaleStatus.DRAFT, index: true })
    status: GradeScaleStatus;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    updatedBy?: Types.ObjectId;
}

export const GradeScaleVersionSchema = SchemaFactory.createForClass(GradeScaleVersion);
GradeScaleVersionSchema.index(
    { status: 1 },
    { unique: true, partialFilterExpression: { status: GradeScaleStatus.ACTIVE }, name: 'one_active_grade_scale' },
);
