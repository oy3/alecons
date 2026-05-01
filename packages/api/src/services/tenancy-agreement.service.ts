import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  TenancyAgreement,
  TenancyAgreementDocument,
} from "../schemas/tenancy-agreement.schema";
import { Student, StudentDocument } from "../schemas/student.schema";
import {
  Application,
  ApplicationDocument,
} from "../schemas/application.schema";
import { UploadService } from "./upload.service";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class TenancyAgreementService {
  private readonly logger = new Logger(TenancyAgreementService.name);

  // Image URLs - use CDN in production, fallback to base64 in development
  private readonly logoUrl = process.env.SPACES_CDN_URL
    ? `${process.env.SPACES_CDN_URL}/assets/logo.png`
    : null;

  private readonly signatureUrl = process.env.SPACES_CDN_URL
    ? `${process.env.SPACES_CDN_URL}/assets/provost-sign.png`
    : null;

  constructor(
    @InjectModel(TenancyAgreement.name)
    private tenancyAgreementModel: Model<TenancyAgreementDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Application.name)
    private applicationModel: Model<ApplicationDocument>,
    private uploadService: UploadService
  ) { }

  /**
   * Get base64 encoded image from file system
   */
  private getBase64Image(imagePath: string): string | null {
    try {
      const fullPath = path.join(process.cwd(), imagePath);
      if (fs.existsSync(fullPath)) {
        const imageBuffer = fs.readFileSync(fullPath);
        const base64Image = imageBuffer.toString("base64");
        const extension = path.extname(imagePath).substring(1);
        return `data:image/${extension};base64,${base64Image}`;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to read image: ${imagePath}`, error.message);
      return null;
    }
  }

  /**
   * Get logo image source (URL or base64)
   */
  private getLogoSrc(): string | null {
    if (this.logoUrl) {
      return this.logoUrl;
    }
    // Fallback to local file in development
    return this.getBase64Image("packages/shared/assets/logo.png");
  }

  /**
   * Get signature image source (URL or base64)
   */
  private getSignatureSrc(): string | null {
    if (this.signatureUrl) {
      return this.signatureUrl;
    }
    // Fallback to local file in development
    return this.getBase64Image("packages/shared/assets/provost-sign.png");
  }

  /**
   * Submit tenancy agreement and process it
   */
  async submitTenancyAgreement(userId: string, agreementData: any) {
    try {
      this.logger.log(
        "Processing tenancy agreement submission for user:",
        userId
      );

      // Find student record
      const student = await this.studentModel
        .findOne({
          userId: new Types.ObjectId(userId),
        })
        .populate("applicationId");

      if (!student) {
        throw new NotFoundException("Student record not found");
      }

      // Check if student has already signed agreement
      const existingAgreement = await this.tenancyAgreementModel.findOne({
        studentId: student._id,
      });

      if (existingAgreement) {
        throw new BadRequestException(
          "Tenancy agreement has already been signed"
        );
      }

      // Generate agreement reference
      const agreementReference = this.generateAgreementReference(
        student._id.toString(),
        new Date().getFullYear()
      );

      // Create tenancy agreement record
      const tenancyAgreement = new this.tenancyAgreementModel({
        studentId: student._id,
        agreementReference,
        tenantName: agreementData.personalInfo.tenantName,
        courseOfStudy: agreementData.personalInfo.courseOfStudy,
        residentialAddress: agreementData.personalInfo.residentialAddress,
        phoneNumber: agreementData.personalInfo.phoneNumber,
        parentInfo: agreementData.parentInfo,
        guarantorInfo: agreementData.guarantorInfo,
        hostelInfo: agreementData.hostelInfo,
        agreementTerms: {
          agreedToTerms: agreementData.agreementTerms.agreedToTerms,
          signedAt: new Date(agreementData.agreementTerms.signedAt),
        },
        status: "signed",
      });

      // Save agreement
      const savedAgreement = await tenancyAgreement.save();
      this.logger.log("Tenancy agreement saved with ID:", savedAgreement._id);

      // Generate PDF document
      const documentUrl = await this.generateAgreementPDF(
        savedAgreement,
        student
      );

      // Update agreement with document URL
      savedAgreement.documentUrl = documentUrl;
      await savedAgreement.save();
      this.logger.log(
        "Tenancy agreement process completed for:",
        agreementReference
      );

      return {
        success: true,
        data: {
          agreementId: savedAgreement._id,
          agreementReference,
          documentUrl,
          status: "signed",
          message: "Tenancy agreement signed and processed successfully",
        },
      };
    } catch (error) {
      this.logger.error("Error submitting tenancy agreement:", error.message);
      throw error;
    }
  }

  /**
   * Get tenancy agreement status for a student
   */
  async getTenancyAgreementStatus(userId: string) {
    try {
      const student = await this.studentModel.findOne({
        userId: new Types.ObjectId(userId),
      });

      if (!student) {
        throw new NotFoundException("Student record not found");
      }

      const agreement = await this.tenancyAgreementModel
        .findOne({
          studentId: student._id,
        })
        .sort({ createdAt: -1 }); // Get latest agreement

      const hasSigned = !!agreement;

      return {
        success: true,
        data: {
          status: hasSigned ? "signed" : "not_started",
          hasSigned,
          documentUrl: agreement?.documentUrl || null,
          agreement: agreement
            ? {
              id: agreement._id,
              reference: agreement.agreementReference,
              signedAt: agreement.agreementTerms.signedAt,
              status: agreement.status,
            }
            : null,
        },
      };
    } catch (error) {
      this.logger.error(
        "Error getting tenancy agreement status:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Get tenancy agreement document details
   */
  async getTenancyAgreementDocument(userId: string) {
    try {
      const student = await this.studentModel.findOne({
        userId: new Types.ObjectId(userId),
      });

      if (!student) {
        throw new NotFoundException("Student record not found");
      }

      // Check if student has signed agreement
      const agreement = await this.tenancyAgreementModel
        .findOne({
          studentId: student._id,
        })
        .sort({ createdAt: -1 });

      if (!agreement) {
        throw new NotFoundException(
          "No tenancy agreement found for this student"
        );
      }

      return {
        success: true,
        data: {
          agreement: {
            id: agreement._id,
            reference: agreement.agreementReference,
            documentUrl: agreement.documentUrl,
            status: agreement.status,
            signedAt: agreement.agreementTerms.signedAt,
            tenantName: agreement.tenantName,
            courseOfStudy: agreement.courseOfStudy,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        "Error getting tenancy agreement document:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Generate agreement reference number
   */
  private generateAgreementReference(
    studentId: string,
    year: number = null
  ): string {
    const currentYear = year || new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `ALECONS-TA-${currentYear}-${studentId.slice(-6)}-${timestamp}`;
  }

  /**
   * Generate PDF document for the tenancy agreement and upload to DigitalOcean Spaces
   */
  private async generateAgreementPDF(
    agreement: TenancyAgreementDocument,
    student: StudentDocument
  ): Promise<string> {
    try {
      this.logger.log(
        "Generating PDF for agreement:",
        agreement.agreementReference
      );

      // Get application details for proper file organization
      const application = await this.applicationModel.findById(
        student.applicationId
      );
      const applicationNumber = application?.applicationNumber || "unknown";

      // Generate PDF filename with proper naming convention
      const fileName = `tenancy-agreement-${agreement.agreementReference}.pdf`;

      // TODO: Generate actual PDF content with all agreement details
      // For now, create a simple buffer as placeholder
      const pdfBuffer = await this.generateTenancyAgreementPDFBuffer(agreement);

      // Create a file-like object for upload service
      const fileObject = {
        buffer: pdfBuffer,
        originalname: fileName,
        mimetype: "application/pdf",
        size: pdfBuffer.length,
      } as Express.Multer.File;

      // Upload to DigitalOcean Spaces using existing upload service
      const uploadResult = await this.uploadService.uploadToSpaces(
        fileObject,
        applicationNumber,
        "tenancy_agreement",
        false // Not temp file
      );

      this.logger.log(
        "PDF generated and uploaded successfully:",
        uploadResult.url
      );
      return uploadResult.url;
    } catch (error) {
      this.logger.error("Error generating agreement PDF:", error.message);
      throw error;
    }
  }

  /**
   * Generate PDF buffer for tenancy agreement using Puppeteer
   */
  private async generateTenancyAgreementPDFBuffer(
    agreement: TenancyAgreementDocument
  ): Promise<Buffer> {
    try {
      const puppeteer = await import("puppeteer");
      const html = this.createTenancyAgreementHTML(agreement);

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfData = await page.pdf({
        format: "A4",
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
        printBackground: true,
      });

      await browser.close();

      this.logger.log("Tenancy agreement PDF generated successfully");
      return Buffer.from(pdfData);
    } catch (error) {
      this.logger.error("Failed to generate tenancy agreement PDF:", error);
      throw error;
    }
  }

  /**
   * Create the HTML template for tenancy agreement matching the official format
   */
  private createTenancyAgreementHTML(
    agreement: TenancyAgreementDocument
  ): string {
    const signedDate = new Date(agreement.agreementTerms.signedAt);
    const day = signedDate.getDate();
    const month = signedDate.toLocaleDateString("en-GB", { month: "long" });
    const year = signedDate.getFullYear();

    // Get logo and signature sources using the same method as admission letter
    const logoSrc = this.getLogoSrc();
    const signatureSrc = this.getSignatureSrc();

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Tenancy Agreement - ${agreement.tenantName}</title>
    <style>
        @page {
            margin: 0;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10pt;
            line-height: 1.6;
            color: #000;
            margin: 0;
            padding: 0;
        }
        .letterhead {
            width: 100%;
            padding: 0 0 20px 0px;
            margin-bottom: 20px;
        }
        .letterhead-table {
            width: 100%;
            border-collapse: collapse;
        }
        .logo-cell {
            width: 80px;
            vertical-align: middle;
            text-align: left;
        }
        .logo-cell img {
            width: 80px;
            height: 80px;
            object-fit: contain;
        }
        .school-info-cell {
            vertical-align: middle;
            text-align: center;
            padding-left: 0px;
        }
        .school-name {
            font-size: 14pt;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-weight: bold;
            color: #C62828;
            margin: 0;
            text-transform: uppercase;
        }
        .school-subtitle {
            font-size: 10pt;
            font-style: italic;
            color: #444;
            margin: 0 0 8px 0;
        }
        .school-contact {
            font-size: 10pt;
            color: #444;
            margin: 0;
        }
        .content {
            padding: 0 50px;
        }
        .document-title {
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
            margin: 40px 0;
            text-transform: uppercase;
        }
        .between-section {
            font-size: 10pt;
            font-weight: bold;
            text-align: center;
            margin: 30px 0;
            text-transform: uppercase;
        }
        .landlord-info {
            text-align: center;
            margin: 20px 0;
            line-height: 1.8;
        }
        .tenant-line {
            text-align: center;
            margin: 30px 0;
            padding-bottom: 10px;
        }
        .property-description {
            text-align: center;
            margin: 40px 0;
            font-weight: bold;
            text-transform: uppercase;
        }
        .date-section {
            text-align: center;
            margin: 40px 0;
            font-weight: bold;
            text-transform: uppercase;
        }
        .agreement-body {
            text-align: justify;
            margin: 30px 0;
            line-height: 1.6;
            page-break-before: always;
        }
        .whereas-section {
            margin: 20px 0;
        }
        .whereas-item {
            margin: 15px 0;
            padding-left: 20px;
        }
        .conditions-section {
            margin: 30px 0;
        }
        .condition-item {
            margin: 10px 0;
            text-align: justify;
            line-height: 1.5;
        }
        .signature-section {
            margin-top: 50px;
        }
        .signature-section p {
            margin: 8px 0;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="letterhead">
        <table class="letterhead-table">
            <tr>
                <td class="logo-cell">
                    ${logoSrc ? `<img src="${logoSrc}" alt="College Logo" />` : ''}
                </td>
                <td class="school-info-cell">
                    <div class="school-name">Alebiosu College of Nursing Sciences</div>
                    <div class="school-subtitle">Excellence in Nursing Education</div>
                    <div class="school-contact">
                        Omuo Oke, Ekiti State • Tel: +234 708 460 1610 • Email: info@alecons.edu.ng
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <div class="content">
        <div class="document-title">TENANCY AGREEMENT</div>

        <div class="between-section">BETWEEN:</div>

        <div class="landlord-info">
            <strong>MR OLUSEGUN</strong> (Trading under the name of<br>
            <strong>Alebiosu College of Arts and Sciences LTD</strong>)<br>
            <strong>(LANDLORD)</strong><br><br>
            <strong>AND</strong>
        </div>

        <div class="tenant-line">
            <strong>${agreement.tenantName}</strong><br>
            <strong>(TENANT)</strong>
        </div>

        <div class="property-description">
            IN RESPECT OF ONE (1) BED SPACE LYING, SITUATE AND BEING<br><br>
            AT <strong>${agreement.hostelInfo.address}</strong>
        </div>

        <div class="date-section">
            DATED THIS <strong>${day}</strong> DAY OF <strong>${month}</strong>, <strong>${year}</strong>
        </div>

        <div class="agreement-body">
            <p>This Tenancy Agreement is made on <strong>${day}</strong> day of <strong>${month}</strong>, <strong>${year}</strong></p>

            <p><strong>BETWEEN:</strong></p>

            <p><strong>MR OLUSEGUN</strong> (trading under name and style of ACAS HOSTEL) <strong>(Hereinafter called 'THE LANDLORD')</strong> which expression shall where the context so admits include her assignments, privies, representatives, attorneys and successors on the one part.</p>

            <p><strong>AND</strong></p>

            <p><strong>${agreement.tenantName}</strong> of <strong>${agreement.residentialAddress
      }</strong> <strong>(Hereinafter called 'THE TENANT')</strong>, which expression shall where the context so admits include his/her assignments, privies and successors on the second part.</p>

            <div class="whereas-section">
                <p><strong>WHEREAS</strong></p>
                
                <div class="whereas-item">
                    <strong>A.</strong> The Subject Matter of this agreement is a One (1) bed space within the hostel situated and located at <strong>${agreement.hostelInfo.address
      }</strong> (called ACAS hostel) which is owned by the Landlord and the Tenant wants to rent it.
                </div>

                <div class="whereas-item">
                    <strong>B.</strong> The Landlord built a hostel which comprises many rooms or apartments for commercial purposes, that is, renting the hostels to tenants. The Landlord will operate the hostel as ACAS HOSTEL.
                </div>

                <div class="whereas-item">
                    <strong>C.</strong> The rent for a bed space per year is N100, 000, 00k (only) including utilities and N5,000 for general fix around space (total= N105,000). Same having been paid prior to the execution of the agreement, the receipt the Landlord acknowledged. The tenancy of the Tenant takes effect as from <strong> ${agreement.hostelInfo.tenancyStartDate
      }</strong> to <strong>${agreement.hostelInfo.tenancyEndDate
      }</strong></div>

                <div class="whereas-item">
                    <strong>D.</strong> Any major damage done to the hostel and everything in it by the Tenant, his/her family members, friends, employees or anybody under/claiming title from him/her while he/she is in possession shall be solely responsible for the repair, replacement or pay for it.
                </div>

                <div class="whereas-item">
                    <strong>E.</strong> That if the tenant is desirous of renewing or terminating this tenancy, he/she shall give the Landlord a Notice in writing of such intention at least one (1) month before the expiration of his or her tenancy. The Landlord has absolute discretion to accept the renewal or termination notice given by the tenant, while the landlord determines the desirability of the renewal upon such terms and conditions as he deems fit.
                </div>

                <div class="whereas-item">
                    <strong>F.</strong> The Landlord has agreed to let the said bed space to the Tenant and the latter has agreed to take the hostel subject to the terms and conditions hereinunder provided.
                </div>
            </div>

            <div class="conditions-section">
                <p><strong>THE LANDLORD HEREBY GIVES CONDITIONS TO THE TENANT WHICH THE TENANT AGREE AS FOLLOWS:</strong></p>

                <div class="condition-item">
                    <strong>1.</strong> The rent is payable yearly and in advance on or before the date the tenancy expires.
                </div>

                <div class="condition-item">
                    <strong>2.</strong> The Tenant shall provide the following data in full: Name of Tenant; Course of study; Residential address; Phone Number; Parents' Name and phone nos; Father's and/or Guarantor's name and Phone Number. Same shall be completed on ACAS Resident form and returned to the Management with a recent passport photograph attached to it with evidence of payment of rent and signed Agreement.
                </div>

                <div class="condition-item">
                    <strong>3.</strong> The above is a condition precedent to the allocation of bed space in a room.
                </div>

                <div class="condition-item">
                    <strong>4.</strong> The Tenant shall provide a person or means who is blood related to him or her as guarantor.
                </div>

                <div class="condition-item">
                    <strong>5.</strong> No partying of any form is allowed in the hostel, its surroundings/environment without the express permission and/or consent of the Management.
                </div>

                <div class="condition-item">
                    <strong>6.</strong> Any form of illicit or hard drugs is not permitted in the hostel, its surroundings or hostel premises. Wherever the tenant is found with any illicit/hard drug or traced to him/her, the tenancy will be automatically terminated and rent (whether reminder or all) shall not be refunded.
                </div>

                <div class="condition-item">
                    <strong>7.</strong> The tenant shall be responsible for the maintenance of the electrical appliances in the Apartment.
                </div>

                <div class="condition-item">
                    <strong>8.</strong> Drinking and selling of alcoholic drinks/substances is not permitted in the Hostel or its surroundings.
                </div>

                <div class="condition-item">
                    <strong>9.</strong> Fighting is prohibited in the Hostel and hostel facility. All disagreements/ must be reported to the management for quick resolution.
                </div>

                <div class="condition-item">
                    <strong>10.</strong> The tenant shall not belong to any occultic group/association or secret society. The only two religions permitted to be practiced in the hostel or apartment by the tenant are Christianity and Islam.
                </div>

                <div class="condition-item">
                    <strong>11.</strong> There shall be quarterly inspection of the Apartment at reasonable hours to inspect the conditions of the Apartment and its fixtures and fittings both exterior and interior by the management. Any damage done to the hostel must be fixed or replaced by the tenant between two (2) and four (4) weeks.
                </div>

                <div class="condition-item">
                    <strong>12.</strong> Where the Tenant fails to repair the damage done, the cost of repairing shall be calculated and deducted from the Tenant's rent and this will automatically reduce the rent tenure.
                </div>

                <div class="condition-item">
                    <strong>13.</strong> Any damage done to or in the Apartment and its appurtenances must be reported to the management and be replaced by the Tenant between two (2) and four (4) weeks. Failure on the part of the tenant will lead to the termination of tenancy and eviction of the tenant without refund.
                </div>

                <div class="condition-item">
                    <strong>14.</strong> No tenant is allowed to operate the generating set powering the Hostel where the hostel is situated except an authorized person. When provided, the generator will run for two hours daily between 7:30pm and 9:30pm.
                </div>

                <div class="condition-item">
                    <strong>15.</strong> Further to the above, the tenant with other tenants shall bear the cost of running and maintaining the generator set. The cost shall be shared equally and be paid at the beginning of each month into a designated account provided by the management.
                </div>

                <div class="condition-item">
                    <strong>16.</strong> Apart from the facilities and appliances/fittings provided in the hostel by the Management, no other appliances shall be used or connected to the Generator set whenever it is used in the Hostel. Similarly, only the bulbs in the Apartment and/or its surrounding must only be used with the Inverter. Neither should the tenant iron with the inverter at any time.
                </div>

                <div class="condition-item">
                    <strong>17.</strong> The tenant shall not make noise or constitute nuisance in the Hostel or Hostel environment.
                </div>

                <div class="condition-item">
                    <strong>18.</strong> No clothes, mats and other things shall be spread in and around the Apartment or Hostel except the designated place.
                </div>

                <div class="condition-item">
                    <strong>19.</strong> The interior of the Apartment shall be kept in good and tenantable conditions inclusive of reasonable repairs of the same and at the final determination of tenancy.
                </div>

                <div class="condition-item">
                    <strong>20.</strong> The Apartment shall not be for any illegal, immoral or improper purposes, hence the Demised premises is strictly for residential purpose.
                </div>

                <div class="condition-item">
                    <strong>21.</strong> The Apartment shall not be overcrowded at all times. There shall be a maximum number of eight (8) in the Management.
                </div>

                <div class="condition-item">
                    <strong>22.</strong> The Apartment shall not be subleased or assign or transfer or part to anybody or used as lien. Whenever any sublet is discovered, it shall be treated as breach of the agreement. The tenancy shall be terminated and the Tenant and/or anybody on the Apartment on his authority shall be evicted.
                </div>

                <div class="condition-item">
                    <strong>23.</strong> The tenant shall always do proper cleaning of the Apartment at all material time and bear the entire maintenance cost.
                </div>

                <div class="condition-item">
                    <strong>24.</strong> The tenant shall not carry out any alteration of the apartment hereby demised without the prior approval in writing of the Landlord.
                </div>

                <div class="condition-item">
                    <strong>25.</strong> The tenant shall keep the cooking gas (if any) in the kitchen only for safety purposes.
                </div>

                <div class="condition-item">
                    <strong>26.</strong> Further to the above, the use of heater, boiling ring, hot plate and any other appliances that consume electricity are prohibited.
                </div>

                <div class="condition-item">
                    <strong>27.</strong> To seek and secure the consent of the Landlord before doing or carrying out any structural amendment or alteration.
                </div>

                <div class="condition-item">
                    <strong>28.</strong> The tenant agrees with the Landlord/Management that the hostel is in good condition suitable for residential before he/she takes possession of the same. The fact he or she knew and acknowledged before executing this agreement.
                </div>

                <div class="condition-item">
                    <strong>29.</strong> The rent of the hostel shall be increased as deemed fit by the Management.
                </div>

                <div class="condition-item">
                    <strong>30.</strong> Whenever the landlord withholds her consent/authority on any issue such shall be final. Any violation of it by the tenant automatically terminates this tenancy and the Management shall eject the tenant.
                </div>

                <div class="condition-item">
                    <strong>31.</strong> Where any part of the Apartment is damaged or lost, the Tenant shall be held responsible for it and the landlord is free to take legal action to recover the damaged part/item in the Demised premises.
                </div>

                <div class="condition-item">
                    <strong>32.</strong> It is agreed that any breach of the covenants/conditions/terms above, same will be treated as notice to quit and determination of the tenancy. The tenants shall be ejected/evicted within two weeks without refund.
                </div>
            </div>

            <div class="signature-section">
                <p><strong>IN WITNESS WHERE OF,</strong> the parties hereto have executed this Tenancy Agreement electronically on the day and year first above written.</p> 
                
              <div style="margin: 25px 0 0 0;">
                <p> <strong>SIGNED BY</strong> the within named "<strong>LANDLORD</strong>"</p>
                <p  class="margin-bottom: 0px;"><strong>MR. OLUSEGUN</strong></p>
                <p class="margin: 0">(Trading under name and style of ACAS HOSTELS)</p>
              </div>
                
                <div style="margin: 20px 0 0 0;">
                  <p><strong>IN THE PRESENCE OF:</strong></p>
                    ${signatureSrc
        ? `<div style="margin: 10px 0;"><img src="${signatureSrc}" alt="Provost Signature" style="max-height: 50px; width: auto;" /></div>`
        : ""
      }
                        <p class="margin-bottom: 0px;"><strong>Yewande Akute</strong></p>
                  <p class="margin: 0px;"><i>Provost</i></p>
                </div>
                
                <div style="margin: 30px 0 0 0;">
                  <p><strong>SIGNED BY</strong> the within named "<strong>TENANT</strong>"</p>
                  <p><strong>${agreement.tenantName}</strong></p>
                </div>
                
                <div style="margin: 20px 0 0 0;">
                    <p><strong>IN THE PRESENCE OF:</strong></p>
                    <p>NAME: <strong>${agreement.guarantorInfo.name
      }</strong></p>
                    <p>ADDRESS: <strong>${agreement.guarantorInfo.address
      }</strong></p>
                    <p>OCCUPATION: <strong>${agreement.guarantorInfo.occupation
      }</strong></p>
                    <p>RELATIONSHIP: <strong>${agreement.guarantorInfo.relationship
      }</strong></p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Check if student can make accommodation payments
   */
  async canMakeAccommodationPayment(userId: string): Promise<boolean> {
    try {
      const student = await this.studentModel.findOne({
        userId: new Types.ObjectId(userId),
      });

      if (!student) {
        return false;
      }

      // Check if tenancy agreement exists
      const agreement = await this.tenancyAgreementModel.findOne({
        studentId: student._id,
      });

      return !!agreement;
    } catch (error) {
      this.logger.error(
        "Error checking accommodation payment eligibility:",
        error.message
      );
      return false;
    }
  }
}
