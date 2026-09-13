import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AccommodationService } from "../services/accommodation.service";
import {
  CompleteExternalAccommodationDto,
  CreateHostelBlockDto,
  CreateHostelDto,
  CreateHostelRoomDto,
  ManualAllocationDto,
  SignExternalTenancyAgreementDto,
  StartExternalAccommodationDto,
  UpdateAccommodationInventoryDto,
  UpdateHostelBlockDto,
  UpdateHostelDto,
  UpdateHostelRoomDto,
} from "../dto/accommodation.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserRole } from "../schemas/user.schema";
import { RolesService } from "../services/roles.service";
import { Response } from "express";

@ApiTags("Public Accommodation")
@Controller("accommodation/external")
export class PublicAccommodationController {
  constructor(private readonly accommodationService: AccommodationService) {}

  @Get("config")
  config() {
    return this.accommodationService.externalConfig();
  }

  @Post("start")
  start(@Body() body: StartExternalAccommodationDto) {
    return this.accommodationService.startExternal(body);
  }

  @Get("verify")
  verify(@Query("token") token: string) {
    return this.accommodationService.verifyExternalEmail(token);
  }

  @Get("resume")
  resume(@Query("token") token: string) {
    return this.accommodationService.resumeExternal(token);
  }

  @Post("complete")
  @UseInterceptors(FileInterceptor("profile"))
  complete(
    @Query("token") token: string,
    @Body() body: CompleteExternalAccommodationDto,
    @UploadedFile() profile?: Express.Multer.File,
  ) {
    return this.accommodationService.completeExternal(token, body, profile);
  }

  @Post("agreement")
  signAgreement(
    @Query("token") token: string,
    @Body() body: SignExternalTenancyAgreementDto,
  ) {
    return this.accommodationService.signExternalAgreement(token, body);
  }

  @Post("payment/initialize")
  initializePayment(@Body("resumeToken") resumeToken: string) {
    return this.accommodationService.initializeExternalPayment(resumeToken);
  }

  @Post("payment/options")
  paymentOptions(@Body("resumeToken") resumeToken: string) {
    return this.accommodationService.externalPaymentOptions(resumeToken);
  }

  @Post("payment/manual-transfer")
  @UseInterceptors(FileInterceptor("receipt"))
  submitManualTransfer(
    @Query("token") token: string,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    return this.accommodationService.submitExternalManualTransfer(
      token,
      receipt,
    );
  }

  @Post("payment/verify")
  verifyPayment(@Body() body: { resumeToken: string; reference: string }) {
    return this.accommodationService.verifyExternalPayment(
      body.resumeToken,
      body.reference,
    );
  }

  @Post("documents/:documentType")
  async downloadDocument(
    @Param("documentType") documentType: string,
    @Body("resumeToken") resumeToken: string,
    @Res() response: Response,
  ) {
    const document = await this.accommodationService.downloadExternalDocument(
      resumeToken,
      documentType,
    );
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.fileName}"`,
    );
    response.setHeader("Cache-Control", "private, no-store");
    response.send(document.buffer);
  }
}

@ApiTags("Staff Accommodation Management")
@Controller("staff/accommodation")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StaffAccommodationController {
  constructor(
    private readonly accommodationService: AccommodationService,
    private readonly rolesService: RolesService,
  ) {}

  private actorId(req: any) {
    return String(req.user?._id || req.user?.userId || "");
  }

  private async authorize(req: any, permission: string) {
    if (req.user?.role === UserRole.ADMIN) return;
    const access = await this.rolesService.getUserModuleAccess(
      this.actorId(req),
      "accommodation",
    );
    if (
      !access ||
      (!access.permissions.includes(permission) &&
        !access.permissions.includes("manage"))
    ) {
      throw new ForbiddenException(
        "You do not have the required accommodation permission",
      );
    }
  }

  @Get("applications")
  async applications(@Request() req, @Query() query: any) {
    await this.authorize(req, "view");
    return this.accommodationService.listApplications(query);
  }

  @Get("inventory")
  async inventory(@Request() req, @Query("sessionId") sessionId?: string) {
    await this.authorize(req, "view");
    return this.accommodationService.inventory(sessionId);
  }

  @Post("hostels")
  async createHostel(@Request() req, @Body() body: CreateHostelDto) {
    await this.authorize(req, "configure");
    return this.accommodationService.createHostel(body, this.actorId(req));
  }

  @Post("blocks")
  async createBlock(@Request() req, @Body() body: CreateHostelBlockDto) {
    await this.authorize(req, "configure");
    return this.accommodationService.createBlock(body, this.actorId(req));
  }

  @Post("rooms")
  async createRoom(@Request() req, @Body() body: CreateHostelRoomDto) {
    await this.authorize(req, "configure");
    return this.accommodationService.createRoom(body, this.actorId(req));
  }

  @Patch("hostels/:id")
  async updateHostel(
    @Request() req,
    @Param("id") id: string,
    @Body() body: UpdateHostelDto,
  ) {
    await this.authorize(req, "configure");
    return this.accommodationService.updateHostel(id, body, this.actorId(req));
  }

  @Patch("blocks/:id")
  async updateBlock(
    @Request() req,
    @Param("id") id: string,
    @Body() body: UpdateHostelBlockDto,
  ) {
    await this.authorize(req, "configure");
    return this.accommodationService.updateBlock(id, body, this.actorId(req));
  }

  @Patch("rooms/:id")
  async updateRoom(
    @Request() req,
    @Param("id") id: string,
    @Body() body: UpdateHostelRoomDto,
  ) {
    await this.authorize(req, "configure");
    return this.accommodationService.updateRoom(id, body, this.actorId(req));
  }

  @Post("hostels/:id/status")
  async updateHostelStatus(
    @Request() req,
    @Param("id") id: string,
    @Body() body: UpdateAccommodationInventoryDto,
  ) {
    await this.authorize(req, "configure");
    return this.accommodationService.updateInventoryStatus(
      "hostel",
      id,
      body.active,
      this.actorId(req),
    );
  }

  @Post("blocks/:id/status")
  async updateBlockStatus(
    @Request() req,
    @Param("id") id: string,
    @Body() body: UpdateAccommodationInventoryDto,
  ) {
    await this.authorize(req, "configure");
    return this.accommodationService.updateInventoryStatus(
      "block",
      id,
      body.active,
      this.actorId(req),
    );
  }

  @Post("rooms/:id/status")
  async updateRoomStatus(
    @Request() req,
    @Param("id") id: string,
    @Body() body: UpdateAccommodationInventoryDto,
  ) {
    await this.authorize(req, "configure");
    return this.accommodationService.updateInventoryStatus(
      "room",
      id,
      body.active,
      this.actorId(req),
    );
  }

  @Post("applications/:id/allocate")
  async allocate(
    @Request() req,
    @Param("id") id: string,
    @Body() body: ManualAllocationDto,
  ) {
    await this.authorize(req, "allocate");
    return this.accommodationService.manualAllocate(
      id,
      body.roomId,
      body.slotNumber,
      this.actorId(req),
      body.note,
    );
  }

  @Post("allocations/retry")
  async retry(@Request() req) {
    await this.authorize(req, "allocate");
    return this.accommodationService.retryPendingAllocations(this.actorId(req));
  }

  @Get("applications/:id/audit")
  async audit(@Request() req, @Param("id") id: string) {
    await this.authorize(req, "view");
    return this.accommodationService.auditTrail(id);
  }
}
