<template>
  <div class="modal fade" :class="{ show: show }" :style="{ display: show ? 'block' : 'none' }" tabindex="-1">
    <div class="modal-dialog modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-info-circle me-2"></i>
            Question Import Format Guide
          </h5>
          <button type="button" class="btn-close" @click="$emit('close')"></button>
        </div>
        <div class="modal-body">
          <!-- Format Tabs -->
          <ul class="nav nav-tabs mb-4">
            <li class="nav-item">
              <button 
                class="nav-link"
                :class="{ active: activeFormat === 'excel' }"
                @click="activeFormat = 'excel'"
              >
                <i class="bi bi-file-excel me-1"></i>
                Excel / CSV
              </button>
            </li>
            <li class="nav-item">
              <button 
                class="nav-link"
                :class="{ active: activeFormat === 'pdf' }"
                @click="activeFormat = 'pdf'"
              >
                <i class="bi bi-file-pdf me-1"></i>
                PDF
              </button>
            </li>
            <li class="nav-item">
              <button 
                class="nav-link"
                :class="{ active: activeFormat === 'docx' }"
                @click="activeFormat = 'docx'"
              >
                <i class="bi bi-file-word me-1"></i>
                Word Document
              </button>
            </li>
          </ul>

          <!-- Excel/CSV Format -->
          <div v-if="activeFormat === 'excel'">
            <div class="alert alert-info">
              <h6><i class="bi bi-table me-2"></i>Excel/CSV Column Structure</h6>
              <p class="mb-0">Use the exact column headers below in your spreadsheet:</p>
            </div>
            
            <div class="table-responsive mb-4">
              <table class="table table-bordered">
                <thead class="table-dark">
                  <tr>
                    <th>Column</th>
                    <th>Required</th>
                    <th>Description</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>Question</code></td>
                    <td><span class="badge bg-danger">Yes</span></td>
                    <td>The question text</td>
                    <td>What is the capital of Nigeria?</td>
                  </tr>
                  <tr>
                    <td><code>Type</code></td>
                    <td><span class="badge bg-danger">Yes</span></td>
                    <td>Question type</td>
                    <td>mcq, multi, or essay</td>
                  </tr>
                  <tr>
                    <td><code>Option_A</code></td>
                    <td><span class="badge bg-warning text-dark">MCQ Only</span></td>
                    <td>First option</td>
                    <td>Lagos</td>
                  </tr>
                  <tr>
                    <td><code>Option_B</code></td>
                    <td><span class="badge bg-warning text-dark">MCQ Only</span></td>
                    <td>Second option</td>
                    <td>Abuja</td>
                  </tr>
                  <tr>
                    <td><code>Option_C</code></td>
                    <td><span class="badge bg-secondary">Optional</span></td>
                    <td>Third option</td>
                    <td>Kano</td>
                  </tr>
                  <tr>
                    <td><code>Option_D</code></td>
                    <td><span class="badge bg-secondary">Optional</span></td>
                    <td>Fourth option</td>
                    <td>Port Harcourt</td>
                  </tr>
                  <tr>
                    <td><code>Option_E</code></td>
                    <td><span class="badge bg-secondary">Optional</span></td>
                    <td>Fifth option</td>
                    <td>Ibadan</td>
                  </tr>
                  <tr>
                    <td><code>Answer</code></td>
                    <td><span class="badge bg-danger">Yes</span></td>
                    <td>Correct answer(s)</td>
                    <td>B (for MCQ) or B;D (for multi-select)</td>
                  </tr>
                  <tr>
                    <td><code>Mark</code></td>
                    <td><span class="badge bg-danger">Yes</span></td>
                    <td>Points for question</td>
                    <td>2</td>
                  </tr>
                  <tr>
                    <td><code>Tags</code></td>
                    <td><span class="badge bg-secondary">Optional</span></td>
                    <td>Question categories</td>
                    <td>geography;capital;nigeria</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="row">
              <div class="col-md-6">
                <h6><i class="bi bi-check-circle text-success me-2"></i>Excel Example</h6>
                <div class="bg-light p-3 rounded">
                  <table class="table table-sm mb-0">
                    <thead>
                      <tr style="font-size: 0.75rem;">
                        <th>Question</th>
                        <th>Type</th>
                        <th>Option_A</th>
                        <th>Option_B</th>
                        <th>Answer</th>
                        <th>Mark</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="font-size: 0.75rem;">
                        <td>Capital of Nigeria?</td>
                        <td>mcq</td>
                        <td>Lagos</td>
                        <td>Abuja</td>
                        <td>B</td>
                        <td>2</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="col-md-6">
                <h6><i class="bi bi-download me-2"></i>Download Template</h6>
                <p class="text-muted">Get started with our template file:</p>
                <div class="d-grid gap-2">
                  <button class="btn btn-outline-success" @click="downloadTemplate('excel')">
                    <i class="bi bi-file-excel me-1"></i>
                    Download Excel Template
                  </button>
                  <button class="btn btn-outline-info" @click="downloadTemplate('csv')">
                    <i class="bi bi-filetype-csv me-1"></i>
                    Download CSV Template
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- PDF Format -->
          <div v-if="activeFormat === 'pdf'">
            <div class="alert alert-warning">
              <h6><i class="bi bi-robot me-2"></i>AI-Powered Parsing</h6>
              <p class="mb-0">PDF questions are parsed using AI. Structure your content clearly for best results.</p>
            </div>

            <div class="row">
              <div class="col-md-8">
                <h6><i class="bi bi-list-ol me-2"></i>Recommended Format</h6>
                <div class="bg-light p-3 rounded">
                  <pre class="mb-0" style="font-size: 0.875rem;">
<strong>1. What is the capital of Nigeria?</strong>
   a) Lagos
   b) Abuja
   c) Kano
   d) Port Harcourt
   <em>Answer: b</em>
   <em>Marks: 2</em>

<strong>2. Which of the following are programming languages? (Select all that apply)</strong>
   a) JavaScript
   b) HTML
   c) Python
   d) CSS
   <em>Answer: a, c</em>
   <em>Marks: 3</em>

<strong>3. Explain the concept of object-oriented programming.</strong>
   <em>Type: Essay</em>
   <em>Marks: 10</em>
                  </pre>
                </div>
              </div>
              <div class="col-md-4">
                <h6><i class="bi bi-lightbulb me-2"></i>Tips for Better Parsing</h6>
                <ul class="list-unstyled">
                  <li><i class="bi bi-check text-success me-2"></i>Number questions clearly (1., 2., 3.)</li>
                  <li><i class="bi bi-check text-success me-2"></i>Use consistent option formatting (a), b), c))</li>
                  <li><i class="bi bi-check text-success me-2"></i>Mark answers clearly with "Answer:"</li>
                  <li><i class="bi bi-check text-success me-2"></i>Specify marks with "Marks:" or "Points:"</li>
                  <li><i class="bi bi-check text-success me-2"></i>Use good contrast and readable fonts</li>
                  <li><i class="bi bi-x text-danger me-2"></i>Avoid handwritten text</li>
                  <li><i class="bi bi-x text-danger me-2"></i>Avoid complex tables or graphics</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Word Document Format -->
          <div v-if="activeFormat === 'docx'">
            <div class="alert alert-info">
              <h6><i class="bi bi-file-word me-2"></i>Word Document Guidelines</h6>
              <p class="mb-0">Similar to PDF but with better text recognition. Use consistent formatting for optimal results.</p>
            </div>

            <div class="row">
              <div class="col-md-8">
                <h6><i class="bi bi-type me-2"></i>Recommended Structure</h6>
                <div class="bg-light p-3 rounded">
                  <div style="font-family: 'Times New Roman', serif; line-height: 1.6;">
                    <p><strong>Question 1</strong></p>
                    <p>What is the primary function of the CPU in a computer system?</p>
                    <p>A. Store data permanently<br>
                       B. Execute instructions and perform calculations<br>
                       C. Display information to the user<br>
                       D. Connect to the internet</p>
                    <p><em>Correct Answer: B</em><br>
                       <em>Marks: 2</em><br>
                       <em>Tags: hardware, cpu, computer-science</em></p>
                    
                    <hr style="margin: 20px 0;">
                    
                    <p><strong>Question 2 (Essay)</strong></p>
                    <p>Discuss the advantages and disadvantages of cloud computing for small businesses.</p>
                    <p><em>Type: Essay</em><br>
                       <em>Marks: 15</em><br>
                       <em>Tags: cloud-computing, business, technology</em></p>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <h6><i class="bi bi-gear me-2"></i>Formatting Best Practices</h6>
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title">Styles to Use:</h6>
                    <ul class="list-unstyled small">
                      <li><i class="bi bi-check text-success me-2"></i><strong>Bold</strong> for question numbers</li>
                      <li><i class="bi bi-check text-success me-2"></i><em>Italic</em> for answers and metadata</li>
                      <li><i class="bi bi-check text-success me-2"></i>Consistent indentation</li>
                      <li><i class="bi bi-check text-success me-2"></i>Clear line breaks between questions</li>
                    </ul>
                    
                    <h6 class="card-title mt-3">Avoid:</h6>
                    <ul class="list-unstyled small">
                      <li><i class="bi bi-x text-danger me-2"></i>Mixed fonts in same document</li>
                      <li><i class="bi bi-x text-danger me-2"></i>Complex tables or columns</li>
                      <li><i class="bi bi-x text-danger me-2"></i>Images with text</li>
                      <li><i class="bi bi-x text-danger me-2"></i>Headers and footers</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Common Guidelines -->
          <div class="mt-4">
            <div class="row">
              <div class="col-md-6">
                <div class="card border-success">
                  <div class="card-header bg-success text-white">
                    <h6 class="mb-0"><i class="bi bi-check-circle me-2"></i>Best Practices</h6>
                  </div>
                  <div class="card-body">
                    <ul class="list-unstyled mb-0">
                      <li><i class="bi bi-check text-success me-2"></i>Test with a small file first</li>
                      <li><i class="bi bi-check text-success me-2"></i>Review imported questions before publishing</li>
                      <li><i class="bi bi-check text-success me-2"></i>Use consistent formatting throughout</li>
                      <li><i class="bi bi-check text-success me-2"></i>Include clear answer keys</li>
                      <li><i class="bi bi-check text-success me-2"></i>Specify marks for each question</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card border-warning">
                  <div class="card-header bg-warning text-dark">
                    <h6 class="mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Common Issues</h6>
                  </div>
                  <div class="card-body">
                    <ul class="list-unstyled mb-0">
                      <li><i class="bi bi-x text-danger me-2"></i>Missing column headers in Excel</li>
                      <li><i class="bi bi-x text-danger me-2"></i>Inconsistent answer formats</li>
                      <li><i class="bi bi-x text-danger me-2"></i>Special characters in questions</li>
                      <li><i class="bi bi-x text-danger me-2"></i>Empty rows or incomplete data</li>
                      <li><i class="bi bi-x text-danger me-2"></i>Files larger than 10MB</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Close</button>
          <a 
            href="/docs/question-import-guide.pdf" 
            class="btn btn-primary" 
            target="_blank"
          >
            <i class="bi bi-download me-1"></i>
            Download Full Guide (PDF)
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QuestionFormatGuide',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  data() {
    return {
      activeFormat: 'excel'
    }
  },
  methods: {
    downloadTemplate(format) {
      const templates = {
        excel: {
          filename: 'question_template.xlsx',
          headers: ['Question', 'Type', 'Option_A', 'Option_B', 'Option_C', 'Option_D', 'Option_E', 'Answer', 'Mark', 'Tags'],
          examples: [
            ['What is the capital of Nigeria?', 'mcq', 'Lagos', 'Abuja', 'Kano', 'Port Harcourt', '', 'B', '2', 'geography;nigeria'],
            ['Which are programming languages?', 'multi', 'JavaScript', 'HTML', 'Python', 'CSS', '', 'A;C', '3', 'programming;languages'],
            ['Explain object-oriented programming', 'essay', '', '', '', '', '', '', '10', 'programming;oop']
          ]
        },
        csv: {
          filename: 'question_template.csv',
          content: `Question,Type,Option_A,Option_B,Option_C,Option_D,Option_E,Answer,Mark,Tags
"What is the capital of Nigeria?",mcq,Lagos,Abuja,Kano,"Port Harcourt",,B,2,"geography;nigeria"
"Which are programming languages?",multi,JavaScript,HTML,Python,CSS,,"A;C",3,"programming;languages"
"Explain object-oriented programming",essay,,,,,,,10,"programming;oop"`
        }
      }

      if (format === 'csv') {
        // Create and download CSV
        const blob = new Blob([templates.csv.content], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = templates.csv.filename
        a.click()
        window.URL.revokeObjectURL(url)
      } else if (format === 'excel') {
        // For Excel, we would need a library like xlsx or just provide CSV for now
        this.downloadTemplate('csv')
        this.$swal.fire({
          icon: 'info',
          title: 'Template Downloaded',
          text: 'CSV template downloaded. You can open it in Excel and save as .xlsx format.',
          confirmButtonColor: '#1a5f5f'
        })
      }
    }
  }
}
</script>

<style scoped>
.modal.show {
  background: rgba(0, 0, 0, 0.5);
}

.nav-tabs .nav-link {
  border: none;
  color: #6c757d;
}

.nav-tabs .nav-link.active {
  background-color: #1a5f5f;
  color: white;
  border-color: #1a5f5f;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.table-sm th,
.table-sm td {
  padding: 0.25rem;
}

code {
  background-color: #f8f9fa;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}
</style>