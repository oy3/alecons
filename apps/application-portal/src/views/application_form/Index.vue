<template>
  <div class="application-container">
    <h1>Application Form</h1>
    <div class="application-form">
      <form @submit.prevent="handleSubmit">
        <!-- Personal Information -->
        <section class="form-section">
          <h2>Personal Information</h2>
          <div class="form-group">
            <label for="dateOfBirth">Date of Birth</label>
            <input 
              type="date" 
              id="dateOfBirth" 
              v-model="formData.dateOfBirth" 
              required
            >
          </div>

          <div class="form-group">
            <label for="nationality">Nationality</label>
            <input 
              type="text" 
              id="nationality" 
              v-model="formData.nationality" 
              required
            >
          </div>

          <div class="form-group">
            <label for="address">Residential Address</label>
            <textarea 
              id="address" 
              v-model="formData.address" 
              rows="3" 
              required
            ></textarea>
          </div>
        </section>

        <!-- Educational Background -->
        <section class="form-section">
          <h2>Educational Background</h2>
          <div class="form-group">
            <label for="lastSchool">Last School Attended</label>
            <input 
              type="text" 
              id="lastSchool" 
              v-model="formData.lastSchool" 
              required
            >
          </div>

          <div class="form-group">
            <label for="qualification">Highest Qualification</label>
            <select 
              id="qualification" 
              v-model="formData.qualification" 
              required
            >
              <option value="">Select qualification</option>
              <option value="ssce">SSCE</option>
              <option value="bachelor">Bachelor's Degree</option>
              <option value="master">Master's Degree</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label for="graduationYear">Year of Graduation</label>
            <input 
              type="number" 
              id="graduationYear" 
              v-model="formData.graduationYear" 
              required
            >
          </div>
        </section>

        <!-- Documents Upload -->
        <section class="form-section">
          <h2>Required Documents</h2>
          <div class="form-group">
            <label for="certificate">Academic Certificate</label>
            <input 
              type="file" 
              id="certificate" 
              @change="handleFileUpload($event, 'certificate')"
              accept=".pdf,.jpg,.jpeg,.png"
              required
            >
          </div>

          <div class="form-group">
            <label for="transcript">Academic Transcript</label>
            <input 
              type="file" 
              id="transcript" 
              @change="handleFileUpload($event, 'transcript')"
              accept=".pdf"
              required
            >
          </div>
        </section>

        <button type="submit" class="submit-btn">Submit Application</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const formData = reactive({
  dateOfBirth: '',
  nationality: '',
  address: '',
  lastSchool: '',
  qualification: '',
  graduationYear: '',
  documents: {
    certificate: null,
    transcript: null
  }
})

const handleFileUpload = (event, documentType) => {
  const file = event.target.files[0]
  formData.documents[documentType] = file
}

const handleSubmit = () => {
  // Here you would typically make an API call to submit the application
  console.log('Application submitted:', formData)
  // Navigate to payment page after successful submission
  router.push('/payment')
}
</script>

<style scoped>
.application-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
}

.application-form {
  background: #fff;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.form-section h2 {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

input,
select,
textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

textarea {
  resize: vertical;
}

input[type="file"] {
  padding: 0.5rem 0;
}

.submit-btn {
  width: 100%;
  padding: 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.submit-btn:hover {
  background-color: #45a049;
}
</style>