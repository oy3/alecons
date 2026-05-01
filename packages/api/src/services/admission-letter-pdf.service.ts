import { Injectable, Logger } from "@nestjs/common";
import * as puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs";

export interface AdmissionLetterData {
  studentFirstName: string;
  studentLastName: string;
  studentFullName: string;
  programName: string;
  programType: string;
  academicSession: string;
  acceptanceFee: string;
  acceptanceFeeAmount: string;
  admissionDate: Date;
}

@Injectable()
export class AdmissionLetterPdfService {
  private readonly logger = new Logger(AdmissionLetterPdfService.name);

  // Image URLs - use CDN in production, fallback to base64 in development
  private readonly logoUrl = process.env.SPACES_CDN_URL
    ? `${process.env.SPACES_CDN_URL}/assets/logo.png`
    : null;

  private readonly signatureUrl = process.env.SPACES_CDN_URL
    ? `${process.env.SPACES_CDN_URL}/assets/provost-sign.png`
    : null;

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
   * Generate admission letter PDF
   */
  async generateAdmissionLetter(data: AdmissionLetterData): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;

    try {
      const html = this.createAdmissionLetterHTML(data);

      this.logger.log(
        "Launching Puppeteer browser for admission letter PDF generation...",
      );

      const launchOptions: puppeteer.LaunchOptions = {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      };

      const executablePath =
        process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBytes = await page.pdf({
        format: "A4",
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
        printBackground: true,
      });

      const buffer = Buffer.from(pdfBytes);
      this.logger.log("Admission letter PDF generated successfully");
      return buffer;
    } catch (error) {
      this.logger.error("Failed to generate admission letter:", error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Create the HTML template for admission letter
   */
  private createAdmissionLetterHTML(data: AdmissionLetterData): string {
    // Validate and sanitize data
    const studentFirstName = data.studentFirstName || "";
    const studentLastName = data.studentLastName || "";
    const studentFullName = data.studentFullName || "";
    const programName = data.programName || "";
    const programType = data.programType || "";
    const academicSession = data.academicSession || "";
    const acceptanceFee = data.acceptanceFee || "";
    const acceptanceFeeAmount = data.acceptanceFeeAmount || "";

    const currentDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Extract year from academic session (e.g., "25" from "2025/2026")
    const sessionYear =
      academicSession.split("/")[0]?.slice(-2) ||
      new Date().getFullYear().toString().slice(-2);

    // Generate random reference number
    const random = Math.floor(Math.random() * 900000) + 100000;

    // Get image sources
    const logoSrc = this.getLogoSrc();
    const signatureSrc = this.getSignatureSrc();

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Admission Letter - ${data.studentFullName}</title>
    <style>
        @page {
            margin: 0;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            margin: 0;
            padding: 0;
        }
        .letterhead {
            text-align: center;
            padding: 30px 0 20px 0;
            border-bottom: 3px solid #C62828;
            margin-bottom: 30px;
        }
        .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 15px auto;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .logo img {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: contain;
        }
        .school-name {
            font-size: 15pt;
            font-weight: bold;
            color: #C62828;
            margin: 10px 0 5px 0;
            text-transform: uppercase;
        }
        .school-subtitle {
            font-size: 11pt;
            color: #555;
            font-style: italic;
            margin: 5px 0;
        }
        .school-contact {
            font-size: 9pt;
            color: #666;
            margin-top: 5px;
        }
        .content {
            padding: 0 50px;
        }
        .ref-number {
            font-size: 10pt;
            color: #666;
            margin-bottom: 20px;
        }
        .date {
            text-align: right;
            margin-bottom: 30px;
            font-size: 11pt;
        }
        .salutation {
            margin-bottom: 20px;
            font-size: 12pt;
        }
        .subject {
            text-align: center;
            font-weight: bold;
            text-decoration: underline;
            margin: 25px 0;
            font-size: 10pt;
            text-transform: uppercase;
        }
        .body-text {
            text-align: justify;
            margin-bottom: 15px;
        }
        .requirements {
            margin: 20px 0;
            padding-left: 20px;
        }
        .requirements li {
            margin-bottom: 12px;
        }
        .sub-requirements {
            margin-top: 8px;
            padding-left: 20px;
        }
        .sub-requirements li {
            margin-bottom: 6px;
        }
        .closing {
            margin-top: 30px;
        }
        .signature-section {
            margin-top: 40px;
        }
        .signature-image {
            max-width: 150px;
            max-height: 60px;
            width: auto;
            height: auto;
            object-fit: contain;
            margin-bottom: 5px;
        }
        .signature-line {
            border-top: 1px solid #000;
            width: 200px;
            margin-top: 10px;
        }
        .signature-name {
            font-weight: bold;
            margin-top: 5px;
        }
        .signature-title {
            font-style: italic;
            color: #555;
        }
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80pt;
            color: rgba(45, 125, 125, 0.05);
            z-index: -1;
            font-weight: bold;
        }
        strong {
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="watermark">ALECONS</div>
    
    <div class="letterhead">
        <div class="logo">
            ${
              logoSrc
                ? `<img src="${logoSrc}" alt="ALECONS Logo" />`
                : `
            <!-- SVG fallback if no logo available -->
            <svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#C62828"/>
                <text x="50" y="65" font-size="20" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">ALC</text>
            </svg>
            `
            }
        </div>
        <div class="school-name">Alebiosu College of Nursing Sciences</div>
        <div class="school-subtitle">Excellence in Nursing Education</div>
        <div class="school-contact">
            Iyamoye-Abuja Road, Omuoke, Ekiti State, Nigeria<br>
            Tel: +234 916 000 8679 | Email: admissions@alecons.edu.ng | Website: www.alecons.edu.ng           
        </div>
    </div>

    <div class="content">
        <div class="ref-number">
            Ref: ALECONS/ADM/${sessionYear}/${random}
        </div>

        <div class="date">
            ${currentDate}
        </div>

        <div class="salutation">
            Dear ${studentFirstName} ${studentLastName},
        </div>

        <div class="subject">
            Provisional Offer of Admission: ${programType} ${programName}
        </div>

        <div class="body-text">
            Following a review of your application for admission into this institution, you are hereby
            offered <strong>provisional admission</strong> into the <strong>${academicSession}</strong> Academic session 
            for the <strong>${programName}</strong> programme.
        </div>

        <div class="body-text">
            The admission is based on fulfilling the following requirements:
        </div>

        <ol class="requirements">
            <li>
                Payment of acceptance fees of <strong>${acceptanceFee} naira only (₦${acceptanceFeeAmount})</strong>
            </li>
            <li>
                All fees are expected to be paid via school application portal and are neither negotiable nor refundable
            </li>
            <li>
                Satisfactory medical report obtained from a reputable government hospital
            </li>
            <li>
                Satisfactory verification of your credentials
            </li>
            <li>
                Acceptance of the offer of admission within <strong>fourteen (14) days</strong>
            </li>
            <li>
                Payment for school accommodation via school student portal (compulsory for all students)
            </li>
            <li>
                Submission of the following on resumption:
                <ol class="sub-requirements" type="i">
                    <li>
                        A letter of good conduct from your referees
                    </li>
                    <li>
                        Birth certificate/declaration of age and eight (8) passport photographs
                    </li>
                    <li>
                        Admission letter (this document)
                    </li>
                    <li>
                        Original and photocopy of credentials (Original is for sighting only)
                    </li>
                </ol>
            </li>
        </ol>

        <div class="closing">
            <p><strong>Accept our congratulations!</strong></p>
            <p>Yours faithfully,</p>
            <p style="margin-top: 5px;"><strong>For: ALEBIOSU COLLEGE OF NURSING SCIENCES</strong></p>
        </div>

        <div class="signature-section">
            ${signatureSrc ? `<img src="${signatureSrc}" alt="Provost Signature" class="signature-image" />` : ""}
            <div class="signature-line"></div>
            <div class="signature-name">Yewande Akute</div>
            <div class="signature-title">Provost</div>
        </div>
    </div>
</body>
</html>
        `;
  }

  /**
   * Save PDF to file system (optional, for testing)
   */
  async saveAdmissionLetterToFile(
    data: AdmissionLetterData,
    filePath: string,
  ): Promise<void> {
    try {
      const buffer = await this.generateAdmissionLetter(data);
      fs.writeFileSync(filePath, buffer);
      this.logger.log(`Admission letter saved to: ${filePath}`);
    } catch (error) {
      this.logger.error("Failed to save admission letter:", error);
      throw error;
    }
  }
}
