import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PortalActivityDto } from '../dto/report.dto';
import { PortalActivityEvent, PortalActivityEventDocument } from '../schemas/portal-activity-event.schema';

@Injectable()
export class PortalActivityService {
  constructor(
    @InjectModel(PortalActivityEvent.name)
    private readonly eventModel: Model<PortalActivityEventDocument>,
  ) {}

  async record(user: any, payload: PortalActivityDto) {
    const userId = user?._id || user?.id || user?.sub;
    if (!userId || !Types.ObjectId.isValid(String(userId))) return { recorded: false };
    const occurredAt = new Date();
    const expiresAt = new Date(occurredAt);
    expiresAt.setMonth(expiresAt.getMonth() + 13);
    await this.eventModel.create({
      userId: new Types.ObjectId(String(userId)),
      portal: payload.portal,
      roleSnapshot: String(user?.role || 'unknown'),
      eventType: payload.eventType || 'page_view',
      routeName: payload.routeName,
      pathTemplate: payload.pathTemplate,
      occurredAt,
      expiresAt,
    });
    return { recorded: true };
  }
}

