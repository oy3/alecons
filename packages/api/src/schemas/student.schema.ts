import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentDocument = Student & Document;

@Schema({ timestamps: true })
export class Student {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Application', required: true })
    applicationId: Types.ObjectId;

    @Prop({ required: true, unique: true })
    matricNo: string;

    @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
    program: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramType', required: true })
    programType: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramMode', required: true })
    programMode: Types.ObjectId;

    @Prop({ required: true })
    level: string;

    @Prop({ required: true })
    semester: number;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    session: Types.ObjectId;

    @Prop({ default: true })
    isActive: boolean;
}

export const StudentSchema = SchemaFactory.createForClass(Student);

// Generate matric number before saving
StudentSchema.pre('save', async function (next) {
    if (this.isNew && !this.matricNo) {
        const year = new Date().getFullYear().toString().slice(-2);
        const StudentModel = this.constructor as any;
        const count = await StudentModel.countDocuments({
            createdAt: {
                $gte: new Date(new Date().getFullYear(), 0, 1),
                $lt: new Date(new Date().getFullYear() + 1, 0, 1)
            }
        });

        // Get program details to build matric number
        // Format: ALEC/ND/25/001
        this.matricNo = `ALEC/ND/${year}/${String(count + 1).padStart(3, '0')}`;
    }
    next();
});
