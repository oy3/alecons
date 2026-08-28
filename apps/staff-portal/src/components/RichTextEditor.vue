

<script>
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import 'katex/dist/katex.min.css'
import { logger } from '@shared/utils/logger'

// Import KaTeX for formula support
import katex from 'katex'
window.katex = katex

export default {
  name: 'RichTextEditor',
  components: {
    QuillEditor
  },
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Enter your question...'
    },
    maxLength: {
      type: Number,
      default: 100000
    },
    showCharCount: {
      type: Boolean,
      default: true
    },
    hasError: {
      type: Boolean,
      default: false
    },
    errorMessage: {
      type: String,
      default: ''
    },
    readonly: {
      type: Boolean,
      default: false
    },
    compact: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return {
      content: this.modelValue,
      isReady: false
    }
  },
  computed: {
    contentLength() {
      if (!this.content) return 0
      // Strip HTML tags to get accurate character count
      const textContent = this.content.replace(/<[^>]*>/g, '')
      return textContent.length
    },
    editorOptions() {
      const baseConfig = {
        theme: 'snow',
        debug: 'warn',
        placeholder: this.placeholder,
        readOnly: this.readonly
      }

      if (this.compact) {
        // Compact toolbar for options
        return {
          ...baseConfig,
          modules: {
            toolbar: {
              container: [
                ['bold', 'italic', 'underline'],
                [{ 'script': 'sub'}, { 'script': 'super' }],
                 ['blockquote', 'code-block'],
                ['formula', 'image']
              ],
              handlers: {
                'formula': this.insertFormula,
                'image': this.insertImage
              }
            }
          },
          formats: [
            'bold', 'italic', 'underline',
            'script', 'blockquote', 'code-block', 'formula', 'image'
          ]
        }
      } else {
        // Full toolbar for main content
        return {
          ...baseConfig,
          modules: {
            toolbar: {
              container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'script': 'sub'}, { 'script': 'super' }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'indent': '-1'}, { 'indent': '+1' }],
                [{ 'align': [] }],
                ['blockquote', 'code-block'],
                ['formula', 'image'],
                ['clean']
              ],
              handlers: {
                'formula': this.insertFormula,
                'image': this.insertImage
              }
            }
          },
          formats: [
            'header', 'font', 'size',
            'bold', 'italic', 'underline', 'strike',
            'color', 'background',
            'script',
            'list', 'indent', 'align',
            'blockquote', 'code-block',
            'formula', 'image'
          ]
        }
      }
    }
  },
  watch: {
    modelValue: {
      handler(newValue) {
        if (newValue !== this.content) {
          this.content = newValue
          // Force Quill editor to update when content changes from outside
          this.$nextTick(() => {
            const quill = this.$refs.quillEditor?.getQuill()
            if (quill && this.isReady) {
              // Only update if the editor content is different from the new value
              const currentContent = quill.root.innerHTML
              if (currentContent !== (newValue || '')) {
                quill.root.innerHTML = newValue || ''
                // Clear any existing focus to prevent cursor issues
                quill.blur()
              }
            }
          })
        }
      },
      immediate: true
    },
    readonly(newValue) {
      if (this.isReady && this.$refs.quillEditor?.getQuill) {
        this.$refs.quillEditor.getQuill().enable(!newValue)
      }
    }
  },
  methods: {
    handleContentChange(content) {
      this.content = content
      this.$emit('update:modelValue', content)
      this.$emit('change', content)
    },
    onEditorReady(quill) {
      this.isReady = true
      
      // Add custom formula button styling
      const formulaButton = document.querySelector('.ql-formula')
      if (formulaButton) {
        formulaButton.innerHTML = '∑'
        formulaButton.title = 'Insert mathematical formula'
      }
      
      // Configure readonly mode if needed
      if (this.readonly) {
        quill.enable(false)
      }
    },
    insertFormula() {
      const quill = this.$refs.quillEditor?.getQuill()
      if (!quill) return
      
      // Show formula input dialog
      this.showFormulaDialog(quill)
    },
    showFormulaDialog(quill) {
      // Create a simple modal for formula input
      const formula = prompt('Enter LaTeX formula (without $ symbols):')
      if (formula) {
        try {
          // Insert formula at current cursor position
          const range = quill.getSelection()
          quill.insertEmbed(range.index, 'formula', formula)
          quill.setSelection(range.index + 1)
        } catch (error) {
          alert('Invalid formula syntax. Please check your LaTeX code.')
        }
      }
    },
    insertImage() {
      const quill = this.$refs.quillEditor?.getQuill()
      if (!quill) return
      
      // Create file input for image upload
      const input = document.createElement('input')
      input.setAttribute('type', 'file')
      input.setAttribute('accept', 'image/*')
      input.click()
      
      input.onchange = () => {
        const file = input.files[0]
        if (file) {
          this.handleImageUpload(file, quill)
        }
      }
    },
    handleImageUpload(file, quill) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image size should be less than 2MB')
        return
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file')
        return
      }
      
      // Show different loading text based on mode
      const loadingText = this.compact ? 'Processing option image...' : 'Uploading image...'
      const range = quill.getSelection()
      quill.insertText(range.index, loadingText)
      
      // Compress and resize the image
      const compressionSettings = this.compact ? 'option' : 'question'
      this.compressImage(file, compressionSettings)
        .then(compressedDataUrl => {
          // Remove loading text
          quill.deleteText(range.index, loadingText.length)
          
          // Insert the compressed image
          quill.insertEmbed(range.index, 'image', compressedDataUrl)
          quill.setSelection(range.index + 1)
        })
        .catch(error => {
          logger.error('Image compression failed:', error)
          // Remove loading text
          quill.deleteText(range.index, loadingText.length)
          const errorMsg = this.compact 
            ? 'Failed to process option image. Please try a smaller image.'
            : 'Failed to process image. Please try again.'
          alert(errorMsg)
        })
    },

    compressImage(file, mode = 'question') {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        
        // Define compression settings based on mode
        const settings = {
          question: {
            maxSize: 800,
            maxDataSize: 50000, // ~50KB
            initialQuality: 0.8,
            minQuality: 0.1
          },
          option: {
            maxSize: 200, // Much smaller for options
            maxDataSize: 15000, // ~15KB max for options
            initialQuality: 0.7,
            minQuality: 0.3
          }
        }
        
        const config = settings[mode] || settings.question
        
        img.onload = () => {
          // Calculate new dimensions
          const maxSize = config.maxSize
          let { width, height } = img
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height
              height = maxSize
            }
          }
          
          // Set canvas dimensions
          canvas.width = width
          canvas.height = height
          
          // Draw and compress the image
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convert to base64 with quality compression
          let quality = config.initialQuality
          let dataUrl = canvas.toDataURL('image/jpeg', quality)
          
          // If still too large, reduce quality further
          while (dataUrl.length > config.maxDataSize && quality > config.minQuality) {
            quality -= 0.1
            dataUrl = canvas.toDataURL('image/jpeg', quality)
          }
          
          // Final check - if still too large, resize further
          if (dataUrl.length > config.maxDataSize) {
            const reductionFactor = mode === 'option' ? 0.5 : 0.7
            const newMaxSize = maxSize * reductionFactor
            const newWidth = (width * newMaxSize) / Math.max(width, height)
            const newHeight = (height * newMaxSize) / Math.max(width, height)
            
            canvas.width = newWidth
            canvas.height = newHeight
            ctx.clearRect(0, 0, newWidth, newHeight)
            ctx.drawImage(img, 0, 0, newWidth, newHeight)
            
            const finalQuality = mode === 'option' ? 0.4 : 0.6
            dataUrl = canvas.toDataURL('image/jpeg', finalQuality)
          }
          
          logger.debug(`Image compressed (${mode}): ${file.size} bytes → ${dataUrl.length} chars`)
          resolve(dataUrl)
        }
        
        img.onerror = () => {
          reject(new Error('Failed to load image'))
        }
        
        // Create object URL for the image
        img.src = URL.createObjectURL(file)
      })
    },
    focus() {
      if (this.$refs.quillEditor?.getQuill) {
        this.$refs.quillEditor.getQuill().focus()
      }
    },
    getQuill() {
      return this.$refs.quillEditor?.getQuill()
    },
    validateContent() {
      if (this.contentLength > this.maxLength) {
        return `Content exceeds maximum length of ${this.maxLength} characters`
      }
      return null
    },
    clearContent() {
      // Clear the content and force editor to reset
      this.content = ''
      this.$emit('update:modelValue', '')
      this.$nextTick(() => {
        const quill = this.$refs.quillEditor?.getQuill()
        if (quill && this.isReady) {
          quill.setText('')
          quill.blur()
        }
      })
    }
  }
}
</script>

<template>
  <div class="rich-text-editor" :class="{ 'compact': compact }">
    <div class="editor-container">
      <QuillEditor
        ref="quillEditor"
        v-model:content="content"
        :options="editorOptions"
        content-type="html"
        @update:content="handleContentChange"
        @ready="onEditorReady"
        :class="{ 'is-invalid': hasError || contentLength > maxLength }"
      />
    </div>
    <div v-if="hasError" class="invalid-feedback d-block">
      {{ errorMessage }}
    </div>
    <div v-if="showCharCount && !compact" class="char-count mt-2">
      <small :class="contentLength > maxLength ? 'text-danger' : 'text-muted'">
        {{ contentLength }}/{{ maxLength }} characters
      </small>
    </div>
    
    <!-- Image upload notice - only show for full editor -->
    <div v-if="!compact" class="image-upload-notice mt-2">
      <small class="text-muted">
        <i class="fas fa-info-circle"></i>
        Images are automatically optimized for better performance (max 800px, compressed quality)
      </small>
    </div>
  </div>
</template>

<style scoped>
.rich-text-editor {
  position: relative;
}

.editor-container {
  /* border-radius: 0.375rem; */
  overflow: hidden;
}

.editor-container :deep(.ql-container) {
  min-height: 200px;
  font-size: 14px;
}

.editor-container :deep(.ql-editor) {
  min-height: 200px;
  padding: 12px 15px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.rich-text-editor:not(.compact) .editor-container :deep(.ql-container) {
  height: clamp(240px, 36vh, 340px);
  min-height: 240px;
}

.rich-text-editor:not(.compact) .editor-container :deep(.ql-editor) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.editor-container :deep(.ql-editor.ql-blank::before) {
  font-style: normal;
  color: #6c757d;
}

/* Error state styling */
.editor-container :deep(.ql-container.is-invalid) {
  border-color: #dc3545;
}

.char-count {
  text-align: right;
}

/* Custom toolbar styling */
.editor-container :deep(.ql-toolbar) {
  border-top: 1px solid #ccc;
  border-left: 1px solid #ccc;
  border-right: 1px solid #ccc;
  background-color: #f8f9fa;
}

.editor-container :deep(.ql-container) {
  border-bottom: 1px solid #ccc;
  border-left: 1px solid #ccc;
  border-right: 1px solid #ccc;
}

/* Formula button styling */
.editor-container :deep(.ql-formula) {
  font-weight: bold;
  font-size: 16px;
}

/* Responsive design */
@media (max-width: 768px) {
  .editor-container :deep(.ql-toolbar) {
    padding: 8px;
  }
  
  .editor-container :deep(.ql-toolbar .ql-formats) {
    margin-right: 8px;
  }
}

/* Custom formula display */
.editor-container :deep(.ql-formula) {
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 2px 4px;
  margin: 0 2px;
  display: inline-block;
}

/* Image styling */
.editor-container :deep(.ql-editor img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 4px 0;
}

/* Compact editor styling */
.rich-text-editor.compact .editor-container :deep(.ql-container) {
  min-height: 40px;
  max-height: 80px;
  overflow-y: auto;
}

.rich-text-editor.compact .editor-container :deep(.ql-editor) {
  min-height: 40px;
  padding: 8px 12px;
  line-height: 1.4;
}

.rich-text-editor.compact .editor-container :deep(.ql-toolbar) {
  padding: 4px 8px;
  border-bottom: none;
}

.rich-text-editor.compact .editor-container :deep(.ql-toolbar .ql-formats) {
  margin-right: 6px;
}

.rich-text-editor.compact .editor-container :deep(.ql-toolbar button) {
  padding: 2px 4px;
  width: 24px;
  height: 24px;
}

.rich-text-editor.compact .editor-container :deep(.ql-editor img) {
  max-width: 60px;
  max-height: 40px;
  margin: 2px;
}
</style>
