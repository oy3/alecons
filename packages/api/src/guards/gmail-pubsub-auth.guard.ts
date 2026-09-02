import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ContactEnquiryGmailService } from '../services/contact-enquiry-gmail.service';

@Injectable()
export class GmailPubSubAuthGuard implements CanActivate {
  constructor(private readonly gmail: ContactEnquiryGmailService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = String(request.headers?.authorization || '');
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new UnauthorizedException('A Pub/Sub identity token is required');

    try {
      await this.gmail.verifyPushToken(match[1]);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid Pub/Sub identity token');
    }
  }
}
