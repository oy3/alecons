import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
    getHealth(): string {
        return this.appService.getHealth();
    }

    @Get('health')
    getHealthCheck() {
        return this.appService.getHealthCheck();
    }
}
