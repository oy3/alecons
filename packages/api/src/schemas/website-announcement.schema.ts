import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongoSchema } from 'mongoose';

export interface WebsiteAnnouncementEntry {
    id: string;
    message: string;
    linkUrl?: string;
    linkLabel?: string;
    startsAt: string;
    endsAt?: string;
    expiredAt?: string;
    supersededAt?: string;
    version: number;
    updatedAt: string;
    audit: {
        action: string;
        actorId: string;
        at: string;
        previous?: unknown;
    }[];
}

@Schema({ timestamps: true })
export class WebsiteAnnouncementBoard {
    @Prop({ type: String })
    _id: string;

    @Prop({ default: 0 })
    revision: number;

    @Prop({ type: [MongoSchema.Types.Mixed], default: [] })
    entries: WebsiteAnnouncementEntry[];
}

export type WebsiteAnnouncementBoardDocument = WebsiteAnnouncementBoard &
    Document;
export const WebsiteAnnouncementBoardSchema = SchemaFactory.createForClass(
    WebsiteAnnouncementBoard,
);
