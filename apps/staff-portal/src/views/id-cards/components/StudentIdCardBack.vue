<script>
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import footerWaveAsset from '@shared/assets/footer-wave.svg';

const BASE_W = 540;
const BASE_H = 856;

export default {
  name: "StudentIdCardBack",

  props: {
    cardData: {
      type: Object,
      required: true,
      // { matricNumber, publicVerificationToken }
    },
    scale: { type: Number, default: 0.55 },
    logoSrc: { type: String, default: null },
    signatureSrc: { type: String, default: null },
  },

  data() {
    return {
      BASE_W,
      BASE_H,
      footerWaveSrc: footerWaveAsset,
      qrCodeDataUrl: null,
      barcodeDataUrl: null,
    };
  },

  watch: {
    cardData: {
      immediate: true,
      deep: true,
      handler() {
        this.refreshCodes();
      },
    },
  },

  computed: {
    wrapperStyle() {
      return {
        width: `${BASE_W * this.scale}px`,
        height: `${BASE_H * this.scale}px`,
        flexShrink: 0,
      };
    },
    cardStyle() {
      return {
        transform: `scale(${this.scale})`,
        transformOrigin: "top left",
        width: `${BASE_W}px`,
        height: `${BASE_H}px`,
      };
    },
  },

  methods: {
    async refreshCodes() {
      await this.generateQrCode();
      this.generateBarcode();
    },

    async generateQrCode() {
      const url = this.cardData?.verificationUrl;
      if (!url) {
        this.qrCodeDataUrl = null;
        return;
      }

      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(url, {
          margin: 1,
          width: 90,
          color: {
            dark: "#1a1a1a",
            light: "#ffffff",
          },
        });
      } catch {
        this.qrCodeDataUrl = null;
      }
    },

    generateBarcode() {
      const rawValue = this.cardData?.matricNumber;
      if (!rawValue) {
        this.barcodeDataUrl = null;
        return;
      }

      try {
        const normalizedValue = String(rawValue)
          .replace(/[^A-Za-z0-9]/g, "")
          .toUpperCase();
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        JsBarcode(svg, normalizedValue, {
          format: "CODE128",
          displayValue: false,
          margin: 4,
          width: 2,
          height: 40,
          background: "#ffffff",
          lineColor: "#000000",
        });
        const svgString = new XMLSerializer().serializeToString(svg);
        this.barcodeDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
      } catch {
        this.barcodeDataUrl = null;
      }
    },
  },
};
</script>

<template>
  <div class="card-scale-wrapper" :style="wrapperStyle">
    <div class="id-card-back" :style="cardStyle">
      <!-- ─── Diagonal lines background ─── -->
      <div class="diagonal-bg"></div>

      <!-- ─── Content area ─── -->
      <div class="back-content">
        <!-- Logo + title -->
        <div class="back-header">
          <img v-if="logoSrc" :src="logoSrc" class="back-logo" alt="Logo" />
          <div class="back-college">ALEBIOSU COLLEGE</div>
          <div class="back-subtitle">OF NURSING SCIENCES</div>
        </div>

        <!-- Divider with dot -->
        <div class="divider-dot">
          <div class="divider-line"></div>
          <div class="divider-circle"></div>
          <div class="divider-line"></div>
        </div>

        <!-- Bearer text -->
        <p class="bearer-text">
          This card identifies the bearer as a student of Alebiosu College of
          Nursing Sciences.
        </p>

        <!-- T&C badge -->
        <div class="tc-badge">TERMS &amp; CONDITIONS</div>

        <!-- Bullets -->
        <ul class="tc-list">
          <li>
            This card is the property of Alebiosu College of Nursing Sciences.
          </li>
          <li>It is non-transferable and must be presented on demand.</li>
          <li>Report loss of this card immediately to the College Bursary.</li>
          <li>Misuse of this card is a disciplinary offence.</li>
        </ul>

        <div class="thin-divider"></div>

        <!-- Contact + QR -->
        <div class="contact-qr-row">
          <div class="contact-info">
            <div class="contact-line">
              <span class="contact-icon">
                <i class="bi bi-geo-alt-fill"></i>
              </span>
              <span>Iyamoye-Abuja Road,<br />Omuoke, Ekiti State.</span>
            </div>
            <div class="contact-line">
              <span class="contact-icon">
                <i class="bi bi-telephone-fill"></i>
              </span>
              0708 460 1610
            </div>
            <div class="contact-line">
              <span class="contact-icon">
                <i class="bi bi-envelope-fill"></i>
              </span>
              info@alecons.edu.ng
            </div>
            <div class="contact-line">
              <span class="contact-icon"> <i class="bi bi-globe"></i> </span>
              www.alecons.edu.ng
            </div>
          </div>
          <!-- QR code -->
          <div class="qr-area">
            <div v-if="qrCodeDataUrl" class="qr-box">
              <img
                :src="qrCodeDataUrl"
                width="100"
                height="100"
                alt="Verification QR code"
              />
            </div>
            <div v-else class="qr-missing">
              <svg viewBox="0 0 100 100" width="80" height="80">
                <rect width="100" height="100" fill="#ffe8e8" rx="4" />
                <text
                  x="50"
                  y="48"
                  text-anchor="middle"
                  font-size="7"
                  fill="#c00"
                >
                  Token missing
                </text>
                <text
                  x="50"
                  y="60"
                  text-anchor="middle"
                  font-size="6"
                  fill="#c00"
                >
                  Export blocked
                </text>
              </svg>
            </div>
          </div>
        </div>

        <!-- Signature -->
        <div class="signature-area">
          <img
            v-if="signatureSrc"
            :src="signatureSrc"
            class="signature-img"
            alt="Signature"
          />
          <div class="signature-label">PROVOST</div>
        </div>
      </div>

      <!-- ─── Footer wave + barcode ─── -->
      <div class="back-footer-area">
        <img v-if="footerWaveSrc" :src="footerWaveSrc" class="footer-wave-bg" alt="" />
        <div class="back-footer">
          <img
            v-if="barcodeDataUrl"
            :src="barcodeDataUrl"
            class="barcode-img"
            :alt="cardData.matricNumber"
          />
          <div v-else class="barcode-placeholder">
            <span class="barcode-text">{{ cardData.matricNumber }}</span>
          </div>
          <div class="return-text">
            IF FOUND, PLEASE RETURN TO THE COLLEGE ADMINISTRATION
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-scale-wrapper {
  position: relative;
  overflow: hidden;
}

.id-card-back {
  position: relative;
  background: #fff;
  font-family: Arial, Helvetica, sans-serif;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
}

.diagonal-bg {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 12px,
    rgba(0, 0, 0, 0.025) 12px,
    rgba(0, 0, 0, 0.025) 13px
  );
  pointer-events: none;
  z-index: 0;
}

.back-content {
  position: relative;
  z-index: 1;
  padding: 35px 50px 0;
}

.back-header {
  text-align: center;
  margin-bottom: 16px;
}
.back-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
}
.back-college {
  font-size: 24px;
  font-weight: 900;
  color: #cd221c;
  letter-spacing: 1px;
  margin-top: 8px;
}
.back-subtitle {
  font-size: 18px;
  color: #333;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-top: 2px;
}

.divider-dot {
  display: flex;
  align-items: center;
  margin: 0 0 16px;
}
.divider-line {
  flex: 1;
  height: 1.5px;
  background: #8b1515;
}
.divider-circle {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #8b1515;
  margin: 0 6px;
  flex-shrink: 0;
}

.bearer-text {
  font-size: 18px;
  line-height: 1.6;
  color: #1a1a1a;
  text-align: justify;
  margin-bottom: 14px;
}

.tc-badge {
  display: inline-block;
  background: #8b1515;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 5px 18px;
  border-radius: 15px;
  margin-bottom: 10px;
}

.tc-list {
  margin: 0 0px 14px 16px;
  padding: 0 0 10px 0;
  font-size: 16px;
  line-height: 1.5;
  color: #1a1a1a;
}
.tc-list li {
  text-align: justify;
  margin-bottom: 4px;
}

.thin-divider {
  height: 1px;
  background: #8b1515;
  margin-bottom: 12px;
}

.contact-qr-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.contact-info {
  font-size: 14px;
  line-height: 1.9;
  color: #1a1a1a;
}
.contact-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 2px;
}
.contact-icon {
  color: #8b1515;
  font-size: 16px;
  flex-shrink: 0;
}
.qr-area {
  flex-shrink: 0;
}
.qr-box,
.qr-missing {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.signature-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 8px;
}
.signature-img {
  height: 48px;
  object-fit: contain;
}
.signature-label {
  font-size: 10px;
  font-weight: 700;
  color: #8b1515;
  letter-spacing: 1px;
  margin-top: 2px;
}

/* Footer */
.back-footer-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 170px;
  z-index: 2;
  overflow: hidden;
}
.footer-wave-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}
.back-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 20px 8px;
  text-align: center;
  z-index: 1;
}
.barcode-placeholder {
  background: #fff;
  display: inline-block;
  padding: 3px 12px;
  border-radius: 2px;
}
.barcode-img {
  height: 40px;
  background: #fff;
  padding: 2px 5px;
  display: inline-block;
}
.barcode-text {
  font-family: "Courier New", monospace;
  font-size: 11px;
  letter-spacing: 2px;
  color: #1a1a1a;
}
.return-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.5px;
  margin-top: 4px;
}
</style>
