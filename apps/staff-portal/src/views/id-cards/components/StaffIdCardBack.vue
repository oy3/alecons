<template>
  <div class="card-scale-wrapper" :style="wrapperStyle">
    <div class="id-card-back" :style="cardStyle">

      <div class="diagonal-bg"></div>

      <div class="back-content">
        <div class="back-header">
          <img v-if="logoSrc" :src="logoSrc" class="back-logo" alt="Logo" />
          <div class="back-college">ALEBIOSU COLLEGE</div>
          <div class="back-subtitle">OF NURSING SCIENCES</div>
        </div>
        <div class="divider-dot">
          <div class="divider-line"></div>
          <div class="divider-circle"></div>
          <div class="divider-line"></div>
        </div>
        <p class="bearer-text">
          This card identifies the bearer as a staff member of Alebiosu College of Nursing Sciences.
        </p>
        <div class="tc-badge">TERMS &amp; CONDITIONS</div>
        <ul class="tc-list">
          <li>This card is the property of Alebiosu College of Nursing Sciences.</li>
          <li>It is non-transferable and must be presented on demand.</li>
          <li>Report loss of this card immediately to the College Bursary.</li>
          <li>Misuse of this card is a disciplinary offence.</li>
        </ul>
        <div class="thin-divider"></div>
        <div class="contact-qr-row">
          <div class="contact-info">
            <div class="contact-line"><span class="contact-icon">📍</span><span>Iyamoye-Abuja Road,<br>&nbsp;&nbsp;&nbsp;&nbsp;Omuoke, Ekiti State.</span></div>
            <div class="contact-line"><span class="contact-icon">📞</span> 0708 460 1610</div>
            <div class="contact-line"><span class="contact-icon">✉</span> info@alecons.edu.ng</div>
            <div class="contact-line"><span class="contact-icon">🌐</span> www.alecons.edu.ng</div>
          </div>
          <div class="qr-area">
            <div v-if="cardData.publicVerificationToken" class="qr-box">
              <svg viewBox="0 0 100 100" width="80" height="80">
                <rect width="100" height="100" fill="#f0f0f0" rx="4"/>
                <text x="50" y="52" text-anchor="middle" font-size="8" fill="#888">QR Code</text>
                <text x="50" y="64" text-anchor="middle" font-size="6" fill="#aaa">(generated on export)</text>
              </svg>
            </div>
            <div v-else class="qr-missing">
              <svg viewBox="0 0 100 100" width="80" height="80">
                <rect width="100" height="100" fill="#ffe8e8" rx="4"/>
                <text x="50" y="48" text-anchor="middle" font-size="7" fill="#c00">Token missing</text>
                <text x="50" y="60" text-anchor="middle" font-size="6" fill="#c00">Export blocked</text>
              </svg>
            </div>
          </div>
        </div>
        <div class="signature-area">
          <img v-if="signatureSrc" :src="signatureSrc" class="signature-img" alt="Signature" />
          <div class="signature-label">PROVOST</div>
        </div>
      </div>

      <div class="back-footer-area">
        <svg :viewBox="`0 0 ${BASE_W} 28`" preserveAspectRatio="none" class="footer-wave-svg">
          <path :d="`M0,28 L0,14 C90,2 180,0 270,12 C360,24 450,20 ${BASE_W},8 L${BASE_W},28 Z`" fill="#8B1515" />
        </svg>
        <div class="back-footer">
          <div class="barcode-placeholder">
            <span class="barcode-text">{{ cardData.staffId }}</span>
          </div>
          <div class="return-text">IF FOUND, PLEASE RETURN TO THE COLLEGE ADMINISTRATION</div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
const BASE_W = 540
const BASE_H = 856

export default {
  name: 'StaffIdCardBack',
  props: {
    cardData: { type: Object, required: true },
    scale: { type: Number, default: 0.55 },
    logoSrc: { type: String, default: null },
    signatureSrc: { type: String, default: null },
  },
  data() {
    return { BASE_W, BASE_H }
  },
  computed: {
    wrapperStyle() {
      return { width: `${BASE_W * this.scale}px`, height: `${BASE_H * this.scale}px`, flexShrink: 0 }
    },
    cardStyle() {
      return { transform: `scale(${this.scale})`, transformOrigin: 'top left', width: `${BASE_W}px`, height: `${BASE_H}px` }
    },
  },
}
</script>

<style scoped>
.card-scale-wrapper { position: relative; overflow: hidden; }
.id-card-back { position: relative; background: #fff; font-family: Arial, Helvetica, sans-serif; overflow: hidden; border-radius: 6px; box-shadow: 0 4px 24px rgba(0,0,0,0.18); }
.diagonal-bg { position: absolute; inset: 0; background: repeating-linear-gradient(45deg,transparent,transparent 12px,rgba(0,0,0,0.025) 12px,rgba(0,0,0,0.025) 13px); pointer-events: none; z-index: 0; }
.back-content { position: relative; z-index: 1; padding: 28px 30px 0; }
.back-header { text-align: center; margin-bottom: 16px; }
.back-logo { width: 68px; height: 68px; object-fit: contain; }
.back-college { font-size: 18px; font-weight: 900; color: #8B1515; letter-spacing: 1px; margin-top: 8px; }
.back-subtitle { font-size: 11px; color: #333; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
.divider-dot { display: flex; align-items: center; margin: 0 0 16px; }
.divider-line { flex: 1; height: 1.5px; background: #8B1515; }
.divider-circle { width: 10px; height: 10px; border-radius: 50%; background: #8B1515; margin: 0 6px; flex-shrink: 0; }
.bearer-text { font-size: 12.5px; line-height: 1.6; color: #1a1a1a; text-align: justify; margin-bottom: 14px; }
.tc-badge { display: inline-block; background: #8B1515; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; padding: 5px 18px; border-radius: 4px; margin-bottom: 10px; }
.tc-list { margin: 0 0 14px 16px; padding: 0; font-size: 12px; line-height: 1.7; color: #1a1a1a; }
.tc-list li { text-align: justify; margin-bottom: 4px; }
.thin-divider { height: 1px; background: #ccc; margin-bottom: 12px; }
.contact-qr-row { display: flex; justify-content: space-between; align-items: flex-start; }
.contact-info { font-size: 11px; line-height: 1.9; color: #1a1a1a; }
.contact-line { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 2px; }
.contact-icon { flex-shrink: 0; }
.qr-area { flex-shrink: 0; }
.qr-box, .qr-missing { border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
.signature-area { display: flex; flex-direction: column; align-items: flex-end; margin-top: 8px; }
.signature-img { height: 48px; object-fit: contain; }
.signature-label { font-size: 10px; font-weight: 700; color: #8B1515; letter-spacing: 1px; margin-top: 2px; }
.back-footer-area { position: absolute; bottom: 0; left: 0; right: 0; }
.footer-wave-svg { display: block; width: 100%; height: 28px; }
.back-footer { background: #6E0F0F; padding: 10px 20px 8px; text-align: center; }
.barcode-placeholder { background: #fff; display: inline-block; padding: 3px 12px; border-radius: 2px; }
.barcode-text { font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 2px; color: #1a1a1a; }
.return-text { font-size: 9px; color: rgba(255,255,255,0.75); letter-spacing: 0.5px; margin-top: 4px; }
</style>
