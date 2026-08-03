import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleDocument = Role & Document;

export interface ModulePermission {
    module: string;
    permissions: string[];
}

@Schema({ timestamps: true })
export class Role {
    @Prop({ required: true, unique: true })
    name: string;

    @Prop()
    description?: string;

    @Prop({
        type: [{
            module: { type: String, required: true },
            permissions: [{ type: String, required: true }]
        }],
        default: []
    })
    modules: ModulePermission[];

    @Prop({ default: true })
    active: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
