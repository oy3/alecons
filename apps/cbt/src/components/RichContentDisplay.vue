<template>
  <div 
    class="rich-content-display" 
    v-html="renderedContent"
    ref="contentContainer"
  ></div>
</template>

<script>
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { logger } from '@shared/utils/logger'

export default {
  name: 'RichContentDisplay',
  props: {
    content: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      renderedContent: ''
    }
  },
  watch: {
    content: {
      handler() {
        this.renderContent()
      },
      immediate: true
    }
  },
  mounted() {
    this.renderContent()
  },
  methods: {
    renderContent() {
      if (!this.content) {
        this.renderedContent = ''
        return
      }

      try {
        // Process content to render math formulas
        let processedContent = this.content

        // Handle KaTeX formulas
        processedContent = this.renderKatexFormulas(processedContent)

        // Ensure images are responsive
        processedContent = this.makeImagesResponsive(processedContent)

        this.renderedContent = processedContent

        // Process any remaining formulas after DOM update
        this.$nextTick(() => {
          this.processFormulasInDOM()
        })
      } catch (error) {
        logger.error('Error rendering rich content:', error)
        // Fallback to plain content
        this.renderedContent = this.content
      }
    },

    renderKatexFormulas(content) {
      // Handle Quill formula format: <span class="ql-formula" data-value="...">
      const formulaRegex = /<span class="ql-formula"[^>]*data-value="([^"]*)"[^>]*>.*?<\/span>/g
      
      return content.replace(formulaRegex, (match, formula) => {
        try {
          const decodedFormula = this.decodeHtml(formula)
          const rendered = katex.renderToString(decodedFormula, {
            throwOnError: false,
            displayMode: false,
            output: 'html'
          })
          return `<span class="katex-inline">${rendered}</span>`
        } catch (error) {
          logger.warn('Failed to render formula:', formula, error)
          return `<code class="formula-error">${formula}</code>`
        }
      })
    },

    makeImagesResponsive(content) {
      // Add responsive classes to images
      return content.replace(
        /<img([^>]+)>/g, 
        '<img class="img-fluid question-image" $1>'
      )
    },

    processFormulasInDOM() {
      if (!this.$refs.contentContainer) return

      // Process any math elements that weren't caught by regex
      const formulaElements = this.$refs.contentContainer.querySelectorAll('.ql-formula')
      
      formulaElements.forEach(element => {
        const formula = element.getAttribute('data-value')
        if (formula) {
          try {
            const decodedFormula = this.decodeHtml(formula)
            katex.render(decodedFormula, element, {
              throwOnError: false,
              displayMode: false
            })
          } catch (error) {
            logger.warn('Failed to render formula in DOM:', formula, error)
            element.textContent = formula
            element.className = 'formula-error'
          }
        }
      })

      // Process any standalone math expressions
      this.processStandaloneMath()
    },

    processStandaloneMath() {
      if (!this.$refs.contentContainer) return

      // Look for $...$ or $$...$$ patterns that might have been added manually
      const textNodes = this.getTextNodes(this.$refs.contentContainer)
      
      textNodes.forEach(node => {
        const text = node.textContent
        
        // Handle display math $$...$$
        if (text.includes('$$')) {
          const displayMathRegex = /\$\$([^$]+)\$\$/g
          const newHTML = text.replace(displayMathRegex, (match, math) => {
            try {
              return katex.renderToString(math.trim(), {
                throwOnError: false,
                displayMode: true
              })
            } catch (error) {
              return `<code class="formula-error">${math}</code>`
            }
          })
          
          if (newHTML !== text) {
            const wrapper = document.createElement('span')
            wrapper.innerHTML = newHTML
            node.parentNode.replaceChild(wrapper, node)
          }
        }
        // Handle inline math $...$
        else if (text.includes('$') && text.match(/\$[^$]+\$/)) {
          const inlineMathRegex = /\$([^$]+)\$/g
          const newHTML = text.replace(inlineMathRegex, (match, math) => {
            try {
              return katex.renderToString(math.trim(), {
                throwOnError: false,
                displayMode: false
              })
            } catch (error) {
              return `<code class="formula-error">${math}</code>`
            }
          })
          
          if (newHTML !== text) {
            const wrapper = document.createElement('span')
            wrapper.innerHTML = newHTML
            node.parentNode.replaceChild(wrapper, node)
          }
        }
      })
    },

    getTextNodes(element) {
      const textNodes = []
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      )
      
      let node
      while (node = walker.nextNode()) {
        textNodes.push(node)
      }
      
      return textNodes
    },

    decodeHtml(html) {
      const txt = document.createElement('textarea')
      txt.innerHTML = html
      return txt.value
    }
  }
}
</script>

<style scoped>
.rich-content-display {
  line-height: 1.6;
  font-size: 1rem;
}

/* Style for mathematical formulas */
.rich-content-display :deep(.katex) {
  font-size: 1.1em;
}

.rich-content-display :deep(.katex-inline) {
  display: inline-block;
  margin: 0 2px;
}

.rich-content-display :deep(.katex-display) {
  margin: 1em 0;
  text-align: center;
}

/* Style for images */
.rich-content-display :deep(.question-image) {
  max-width: 100%;
  /* max-height: 300px; */
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  margin: 10px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Error styling for formulas that failed to render */
.rich-content-display :deep(.formula-error) {
  background-color: #f8d7da;
  color: #721c24;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

/* List styling */
.rich-content-display :deep(ul),
.rich-content-display :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.rich-content-display :deep(li) {
  margin: 0.25em 0;
}

/* Text formatting */
.rich-content-display :deep(strong),
.rich-content-display :deep(b) {
  font-weight: 600;
}

.rich-content-display :deep(em),
.rich-content-display :deep(i) {
  font-style: italic;
}

.rich-content-display :deep(u) {
  text-decoration: underline;
}

.rich-content-display :deep(s) {
  text-decoration: line-through;
}

/* Code styling */
.rich-content-display :deep(code) {
  background-color: #f8f9fa;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.rich-content-display :deep(pre) {
  background-color: #f8f9fa;
  padding: 1em;
  border-radius: 5px;
  overflow-x: auto;
  margin: 1em 0;
}

/* Blockquote styling */
.rich-content-display :deep(blockquote) {
  border-left: 4px solid #007bff;
  margin: 1em 0;
  padding: 0.5em 1em;
  background-color: #f8f9fa;
  font-style: italic;
}

/* Table styling */
.rich-content-display :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.rich-content-display :deep(th),
.rich-content-display :deep(td) {
  border: 1px solid #dee2e6;
  padding: 0.5em;
  text-align: left;
}

.rich-content-display :deep(th) {
  background-color: #f8f9fa;
  font-weight: 600;
}

/* Superscript and subscript */
.rich-content-display :deep(sup) {
  vertical-align: super;
  font-size: 0.8em;
}

.rich-content-display :deep(sub) {
  vertical-align: sub;
  font-size: 0.8em;
}

/* Responsive design */
@media (max-width: 768px) {
  .rich-content-display {
    font-size: 0.95rem;
  }
  
  .rich-content-display :deep(.katex) {
    font-size: 1em;
  }
  
  .rich-content-display :deep(.question-image) {
    margin: 8px 0;
  }
}
</style>