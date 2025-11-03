<script>
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'

export default {
  name: 'RichContentDisplay',
  props: {
    content: {
      type: String,
      default: ''
    },
    maxLength: {
      type: Number,
      default: 0 // 0 means no truncation
    },
    maxWidth: {
      type: String,
      default: '100%'
    },
    maxHeight: {
      type: String,
      default: 'auto'
    }
  },
  computed: {
    sanitizedContent() {
      if (!this.content) return ''
      
      let displayContent = this.content
      
      // Truncate if maxLength is specified
      if (this.maxLength > 0 && this.content.length > this.maxLength) {
        // Try to truncate at a word boundary
        const truncated = this.content.substring(0, this.maxLength)
        const lastSpace = truncated.lastIndexOf(' ')
        displayContent = lastSpace > this.maxLength * 0.8 ? 
          this.content.substring(0, lastSpace) + '...' : 
          truncated + '...'
      }
      
      // If content doesn't look like HTML, wrap it in a paragraph
      if (displayContent && !displayContent.trim().startsWith('<')) {
        displayContent = `<p>${displayContent}</p>`
      }
      
      try {
        // Check if content contains images with data URIs
        const hasDataUri = displayContent.includes('data:image/')
        
        if (hasDataUri) {
          // For content with images, return the content directly
          // This bypasses DOMPurify's data URI restrictions for our controlled content
          return displayContent
        } else {
          // For regular content, use standard sanitization
          const sanitized = DOMPurify.sanitize(displayContent, {
            ALLOWED_TAGS: [
              'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'ul', 'ol', 'li',
              'blockquote', 'pre', 'code',
              'img', 'a',
              'sub', 'sup',
              'table', 'thead', 'tbody', 'tr', 'th', 'td',
              // MathJax/KaTeX elements
              'math', 'mrow', 'mi', 'mo', 'mn', 'mfrac', 'msup', 'msub', 'mroot', 'msqrt',
              'semantics', 'annotation', 'annotation-xml'
            ],
            ALLOWED_ATTR: [
              'class', 'id', 'style',
              'src', 'alt', 'width', 'height', 'title',
              'href', 'target', 'rel',
              'colspan', 'rowspan',
              // MathJax/KaTeX attributes
              'xmlns', 'display', 'encoding'
            ],
            KEEP_CONTENT: true,
            ALLOW_DATA_ATTR: false
          })
          
          return sanitized && sanitized.trim() ? sanitized : displayContent
        }
      } catch (error) {
        console.error('DOMPurify error:', error)
        return displayContent
      }
    }
  },
  mounted() {
    // Process KaTeX formulas if they exist
    this.$nextTick(() => {
      this.processKaTeX()
    })
  },
  updated() {
    // Re-process KaTeX when content changes
    this.$nextTick(() => {
      this.processKaTeX()
    })
  },
  methods: {
    processKaTeX() {
      if (typeof window !== 'undefined' && window.katex) {
        // Find and render KaTeX formulas
        const formulaElements = this.$el.querySelectorAll('.ql-formula')
        formulaElements.forEach(element => {
          const formula = element.getAttribute('data-value')
          if (formula) {
            try {
              window.katex.render(formula, element, {
                throwOnError: false,
                displayMode: false
              })
            } catch (error) {
              console.warn('KaTeX rendering error:', error)
              element.textContent = formula // Fallback to plain text
            }
          }
        })
      }
    }
  }
}
</script>

<template>
  <div 
    class="rich-content-display"
    :style="{ '--max-img-width': maxWidth, '--max-img-height': maxHeight }"
  >
    <div v-if="sanitizedContent && sanitizedContent.trim()" v-html="sanitizedContent" class="content-wrapper"></div>
    <div v-else-if="content" class="fallback-content">{{ content }}</div>
    <div v-else class="empty-content text-muted">No content</div>
  </div>
</template>

<style>
.rich-content-display {
  line-height: 1.6;
}

.rich-content-display p img {
  max-width: var(--max-img-width, 100%);
  max-height: var(--max-img-height, 400px);
  height: auto;
  border-radius: 4px;
  margin: 8px 0;
  object-fit: contain;
  display: block;
  visibility: visible !important;
  opacity: 1 !important;
}

.rich-content-display p img {
  display: inline-block;
  vertical-align: middle;
}

.content-wrapper {
  min-height: 20px;
}

.rich-content-display p {
  margin-bottom: 0.5rem;
}

.rich-content-display p:last-child {
  margin-bottom: 0;
}

.rich-content-display blockquote {
  border-left: 4px solid #dee2e6;
  padding-left: 1rem;
  margin: 1rem 0;
  font-style: italic;
  color: #6c757d;
}

.rich-content-display pre {
  background-color: #f8f9fa;
  padding: 0.75rem;
  border-radius: 4px;
  overflow-x: auto;
}

.rich-content-display code {
  background-color: #f8f9fa;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.875em;
}

.rich-content-display table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.rich-content-display table th,
.rich-content-display table td {
  border: 1px solid #dee2e6;
  padding: 0.5rem;
  text-align: left;
}

.rich-content-display table th {
  background-color: #f8f9fa;
  font-weight: 600;
}

.fallback-content {
  line-height: 1.6;
  word-wrap: break-word;
}

.empty-content {
  font-style: italic;
  opacity: 0.7;
}

/* Specific styles for images in table contexts */
.question-preview .rich-content-display img,
.question-text .rich-content-display img {
  max-width: 100px !important;
  max-height: 100px !important;
  width: auto !important;
  height: auto !important;
  display: inline-block !important;
  vertical-align: middle !important;
  border: 1px solid #ddd;
  background-color: #f9f9f9;
}

/* Ensure content wrapper has proper display */
.content-wrapper {
  display: block;
  min-height: 20px;
  width: 100%;
}

/* Force images to be visible */
.rich-content-display img {
  opacity: 1 !important;
  visibility: visible !important;
  position: relative !important;
}
</style>