<template>
  <!-- Scale wrapper: renders at card-base dimensions, scaled up for display -->
  <div class="card-scale-wrapper" :style="wrapperStyle">
    <div class="id-card-front student" :style="cardStyle">
      <!-- ─── Header ─── -->
      <div class="card-header">
        <img v-if="logoSrc" :src="logoSrc" class="header-logo" alt="Logo" />
        <div class="header-text">
          <div class="header-college">ALEBIOSU COLLEGE</div>
          <div class="header-subtitle">OF NURSING SCIENCES</div>
        </div>
        <svg
          class="header-wave"
          :viewBox="`0 0 ${BASE_W} 28`"
          preserveAspectRatio="none"
        >
          <path
            :d="`M0,28 L0,8 C90,28 180,32 270,18 C360,4 450,8 ${BASE_W},18 L${BASE_W},28 Z`"
            fill="#fff"
          />
        </svg>
      </div>

      <!-- ─── Watermark ─── -->
      <div class="card-watermark">
        <img v-if="logoSrc" :src="logoSrc" alt="" />
      </div>

      <!-- ─── Body ─── -->
      <div class="card-body">
        <!-- Photo + badge -->
        <div class="photo-row">
          <div class="photo-frame">
            <!-- If we have a real photo -->
            <img
              v-if="effectivePhotoSrc"
              :src="effectivePhotoSrc"
              class="photo-img"
              alt="Photo"
            />
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
              <input
                :id="`photo-upload-${uid}`"
                type="file"
                accept="image/*"
                capture="environment"
                class="photo-input"
                @change="onPhotoSelected"
              />
            </label>
          </div>
          <div class="badge-name-area">
            <span class="id-badge">STUDENT ID</span>
            <div class="person-name">{{ cardData.formattedName }}</div>
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
            <span class="field-value">{{ cardData.department }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">PROGRAMME:</span>
            <span class="field-value">{{ cardData.programme }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">ENTRY SESSION:</span>
            <span class="field-value">{{ cardData.entrySession }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">DATE OF ISSUE:</span>
            <span class="field-value">{{ formatDate(dateOfIssue) }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">VALID UNTIL:</span>
            <span class="field-value">{{ formatDate(validUntil) }}</span>
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

<script>
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
  background: #8b1515;
  height: 140px;
  display: flex;
  align-items: center;
  padding: 16px 22px;
  flex-shrink: 0;
}
.header-logo {
  width: 74px;
  height: 74px;
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
  font-size: 21px;
  font-weight: 900;
  letter-spacing: 1px;
  line-height: 1.1;
}
.header-subtitle {
  color: rgba(255, 255, 255, 0.85);
  font-size: 10.5px;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 3px;
}
.header-wave {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  width: 100%;
  height: 28px;
}

/* Watermark */
.card-watermark {
  position: absolute;
  right: 18px;
  top: 155px;
  width: 240px;
  height: 240px;
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
  width: 220px;
  height: 284px;
  border: 2.5px solid #8b1515;
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
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 6px 22px;
  border-radius: 20px;
  display: inline-block;
}
.person-name {
  margin-top: 16px;
  font-size: 26px;
  font-weight: 900;
  color: #1a1a1a;
  line-height: 1.2;
  text-transform: uppercase;
  word-break: break-word;
}

/* Fields */
.fields-list {
  margin-top: 20px;
}
.field-row {
  display: flex;
  align-items: baseline;
  padding: 5px 0;
}
.field-label {
  font-weight: 900;
  color: #1a1a1a;
  width: 180px;
  flex-shrink: 0;
  font-size: 12px;
}
.field-value {
  font-weight: 400;
  color: #1a1a1a;
  font-size: 12px;
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
  height: 22px;
}
.card-footer {
  background: #8b1515;
  padding: 9px 20px;
  text-align: center;
}
.footer-motto {
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  letter-spacing: 2px;
  font-weight: 500;
}
</style>
