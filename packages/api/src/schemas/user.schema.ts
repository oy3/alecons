import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document;

export enum UserRole {
    APPLICANT = 'applicant',
    STUDENT = 'student',
    STAFF = 'staff',
    ADMIN = 'admin',
}

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true, trim: true, lowercase: true })
    email: string;

    @Prop({ required: true })
    passwordHash: string;

    @Prop({ required: true, enum: UserRole, default: UserRole.APPLICANT })
    role: UserRole;

    @Prop({ required: true })
    firstName: string;

    @Prop()
    otherName?: string;

    @Prop({ required: true })
    lastName: string;

    @Prop({ trim: true })
    phone?: string;

    @Prop()
    dob?: Date;

    @Prop()
    gender?: string;

    @Prop()
    profileImageUrl?: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: false })
    isEmailVerified: boolean;

    @Prop()
    emailVerificationToken?: string;

    @Prop()
    emailVerificationTokenExpires?: Date;

    // Virtual for full name
    get fullName(): string {
        return `${this.firstName} ${this.otherName ? this.otherName + ' ' : ''}${this.lastName}`;
    }

    // Method to check password
    async comparePassword(password: string): Promise<boolean> {
        return bcrypt.compare(password, this.passwordHash);
    }
}

export const UserSchema = SchemaFactory.createForClass(User);

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();

    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
});

// Add virtual for fullName
UserSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.otherName ? this.otherName + ' ' : ''}${this.lastName}`;
});

// Add method to schema
UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
};
