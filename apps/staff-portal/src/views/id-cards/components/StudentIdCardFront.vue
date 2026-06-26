<script>
import headerWaveAsset from '@shared/assets/header-wave.svg'
import watermarkAsset from '@shared/assets/logo-black.svg'

const BASE_W = 540;
const BASE_H = 856;

export default {
  name: "StudentIdCardFront",

  props: {
    cardData: {
      type: Object,
      required: true,
      // { formattedName, matricNumber, department, programme, entrySession, photoUrl }
    },
    dateOfIssue: { type: String, default: "" },
    validUntil: { type: String, default: "" },
    scale: { type: Number, default: 0.55 },
    logoSrc: { type: String, default: null },
  },

  emits: ["update:photoOverride"],

  data() {
    return {
      BASE_W,
      BASE_H,
      headerWaveSrc: headerWaveAsset,
      watermarkSrc: watermarkAsset,
      localPhotoDataUrl: null,
      uid: Math.random().toString(36).slice(2, 8),
    };
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
    effectivePhotoSrc() {
      return this.localPhotoDataUrl || this.cardData?.photoUrl || null;
    },
    headerStyle() {
      if (!this.headerWaveSrc) return {};
      return { backgroundImage: `url(${this.headerWaveSrc})` };
    },
  },

  methods: {
    formatDate(iso) {
      if (!iso) return "";
      try {
        const d = new Date(iso);
        const day = d.getDate();
        const suffix = this.ordSuffix(day);
        const months = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        return `${day}${suffix} ${months[d.getMonth()]}, ${d.getFullYear()}`;
      } catch {
        return iso;
      }
    },
    ordSuffix(n) {
      if (n >= 11 && n <= 13) return "th";
      switch (n % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    },
    onPhotoSelected(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.localPhotoDataUrl = ev.target.result;
        this.$emit("update:photoOverride", ev.target.result);
      };
      reader.readAsDataURL(file);
    },
  },
};
</script>

<template>
  <!-- Scale wrapper: renders at card-base dimensions, scaled up for display -->
  <div class="card-scale-wrapper" :style="wrapperStyle">
    <div class="id-card-front student" :style="cardStyle">
      <!-- ─── Header ─── -->
      <div class="card-header" :style="headerStyle">
        <img v-if="logoSrc" :src="logoSrc" class="header-logo" alt="Logo" />
        <div class="header-text">
          <div class="header-college">ALEBIOSU COLLEGE</div>
          <div class="header-subtitle">OF NURSING SCIENCES</div>
        </div>
      </div>

      <!-- ─── Watermark ─── -->
      <div class="card-watermark">
        <img v-if="watermarkSrc" :src="watermarkSrc" alt="" />
      </div>

      <!-- ─── Body ─── -->
      <div class="card-body">
        <!-- Photo + badge -->
        <div class="photo-row d-flex align-items-center">
          <div class="photo-frame">
            <!-- If we have a real photo -->
            <img
              v-if="effectivePhotoSrc"
              :src="effectivePhotoSrc"
              class="photo-img"
              alt="Photo"
              crossorigin="anonymous"
            />
            <label
              v-if="effectivePhotoSrc"
              class="photo-change-overlay"
              :for="`photo-upload-${uid}`"
            >
              Change photo
            </label>
            <!-- No photo: show file picker -->
            <label
              v-else
              class="photo-placeholder"
              :for="`photo-upload-${uid}`"
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="#aaa">
                <path
                  d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
                />
              </svg>
              <span class="photo-hint">Tap to add photo</span>
            </label>
            <input
              :id="`photo-upload-${uid}`"
              type="file"
              accept="image/*"
              capture="environment"
              class="photo-input"
              @change="onPhotoSelected"
            />
          </div>
          <div class="badge-name-area">
            <span class="id-badge">STUDENT ID</span>
            <div class="person-name">
              <span class="person-lastname">{{ cardData.lastName }}</span>
              <br />
              <span>{{ cardData.firstName }} {{ cardData.otherName ? cardData.otherName[0] + '.' : '' }}</span>
            </div>
          </div>
        </div>

        <!-- Fields -->
        <div class="fields-list">
          <div class="field-row">
            <span class="field-label">MATRIC NO.:</span>
            <span class="field-value">{{ cardData.matricNumber }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">DEPARTMENT:</span>
            <span class="field-value text-uppercase">{{ cardData.department }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">PROGRAMME:</span>
            <span class="field-value text-uppercase">ND/HND {{ cardData.programme }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">ENTRY SESSION:</span>
            <span class="field-value">{{ cardData.entrySession }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">DATE OF ISSUE:</span>
            <span class="field-value text-uppercase">{{ formatDate(dateOfIssue) }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">VALID UNTIL:</span>
            <span class="field-value text-uppercase">{{ formatDate(validUntil) }}</span>
          </div>
        </div>
      </div>

      <!-- ─── Footer ─── -->
      <div class="card-footer-area">
        <svg
          :viewBox="`0 0 ${BASE_W} 22`"
          preserveAspectRatio="none"
          class="footer-wave"
        >
          <path
            :d="`M0,22 L0,12 C90,0 180,-2 270,10 C360,22 450,18 ${BASE_W},6 L${BASE_W},22 Z`"
            fill="#8B1515"
          />
        </svg>
        <div class="card-footer">
          <span class="footer-motto">COMPASSION · KNOWLEGDE · CARE</span>
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

.id-card-front {
  position: relative;
  background: #fff;
  font-family: Arial, Helvetica, sans-serif;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
}

/* Header */
.card-header {
  position: relative;
  height: 190px;
  display: flex;
  align-items: top;
  padding: 30px 22px;
  flex-shrink: 0;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  /* background-color: #8b1515; */
}
.header-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
  z-index: 1;
  flex-shrink: 0;
}
.header-text {
  margin-left: 14px;
  z-index: 1;
}
.header-college {
  color: #fff;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 1px;
  line-height: 1.1;
}
.header-subtitle {
  color: rgba(255, 255, 255, 0.85);
  font-size: 20px;
  letter-spacing: 4px;
  text-transform: uppercase;
  margin-top: 3px;
}

/* Watermark */
.card-watermark {
  position: absolute;
  right: -30px;
  bottom: 120px;
  width: 470px;
  height: 470px;
  opacity: 0.06;
  pointer-events: none;
  z-index: 0;
}
.card-watermark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Body */
.card-body {
  padding: 22px 26px 0;
  position: relative;
  z-index: 1;
}

.photo-row {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}
.photo-frame {
  position: relative;
  width: 170px;
  height: 204px;
  border: 1px solid #8b1515;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: #e8e8e8;
}
.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  gap: 8px;
}
.photo-change-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.photo-frame:hover .photo-change-overlay {
  opacity: 1;
}
.photo-hint {
  font-size: 11px;
  color: #999;
}
.photo-input {
  display: none;
}

.badge-name-area {
  flex: 1;
  padding-top: 6px;
}
.id-badge {
  background: #8b1515;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 6px 22px;
  border-radius: 20px;
  display: inline-block;
}
.person-name {
  margin-top: 16px;
  font-size: 32px;
  font-weight: 900;
  color: #1a1a1a;
  line-height: 1.2;
  text-transform: uppercase;
  word-break: break-word;
}

/* Fields */
.fields-list {
  margin-top: 30px;
}
.field-row {
  display: flex;
  align-items: baseline;
  padding: 5px 0;
}
.field-label {
  font-weight: 900;
  color: #1a1a1a;
  width: 220px;
  flex-shrink: 0;
  font-size: 23px;
}
.field-value {
  font-weight: 400;
  color: #1a1a1a;
  font-size: 23px;
}

/* Footer */
.card-footer-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}
.footer-wave {
  display: block;
  width: 100%;
  height: 35px;
  transform: scaleX(-1);
  transform-origin: center;
}
.card-footer {
  background: #8b1515;
  padding: 20px 20px;
  text-align: center;
}
.footer-motto {
  color: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  letter-spacing: 2px;
  font-weight: 500;
}
</style>
