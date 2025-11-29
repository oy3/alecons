<script>
export default {
  name: 'Academics'
}
</script>

<template>
  <div class="academics p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
          <div class="mb-2 mb-md-0">
            <h2 class="h3 fw-bold text-dark mb-1">
              <i class="bi bi-book me-2 text-primary"></i>
              Academic Dashboard
            </h2>
            <p class="text-muted mb-0">Manage your courses, assignments, and academic progress.</p>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-primary btn-sm" disabled>
              <i class="bi bi-download me-1"></i><span class="d-none d-sm-inline">Export Transcript</span><span class="d-sm-none">Export</span>
            </button>
            <button class="btn btn-primary btn-sm" disabled>
              <i class="bi bi-calendar-plus me-1"></i><span class="d-none d-sm-inline">Add Course</span><span class="d-sm-none">Add</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Academic Stats -->
    <div class="row mb-4">
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm text-center">
          <div class="card-body">
            <div class="bg-primary bg-opacity-10 rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-mortarboard text-white fs-3"></i>
            </div>
            <h4 class="fw-bold text-muted">-</h4>
            <p class="text-muted mb-0">Cumulative GPA</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm text-center">
          <div class="card-body">
            <div class="bg-success bg-opacity-10 rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-book-half text-success fs-3"></i>
            </div>
            <h4 class="fw-bold text-muted">-</h4>
            <p class="text-muted mb-0">Current Courses</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm text-center">
          <div class="card-body">
            <div class="bg-warning bg-opacity-10 rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-list-check text-warning fs-3"></i>
            </div>
            <h4 class="fw-bold text-warning">-</h4>
            <p class="text-muted mb-0">Pending Assignments</p>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm text-center">
          <div class="card-body">
            <div class="bg-info bg-opacity-10 rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-calendar-check text-info fs-3"></i>
            </div>
            <h4 class="fw-bold text-info">-</h4>
            <p class="text-muted mb-0">Attendance Rate</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Current Courses Section -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-white border-0 py-3">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
          <h5 class="fw-bold mb-0 mb-2 mb-md-0">Current Semester Courses</h5>
          <div class="d-flex gap-2">
            <select class="form-select form-select-sm" style="width: auto;" disabled>
              <option value="">-- Select --</option>
            </select>
            <button class="btn btn-sm btn-outline-light" disabled>
              <i class="bi bi-funnel"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="card-body">
        <!-- TODO: Replace with actual course data from backend when course registration system is implemented -->
        <div class="text-center py-5">
          <i class="bi bi-book text-muted" style="font-size: 4rem;"></i>
          <h5 class="text-muted mt-4 mb-3">No Courses Registered</h5>
          <p class="text-muted">You haven't registered for any courses yet.</p>
          <p class="text-muted small">The course registration system will be available soon.</p>
          <button class="btn btn-primary mt-3" disabled>
            <i class="bi bi-plus-circle me-2"></i>Register for Courses
          </button>
        </div>
        
        <!-- COMMENTED OUT: Mock course data - uncomment when backend is ready
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th class="border-0 fw-bold">Course</th>
                <th class="border-0 fw-bold d-none d-md-table-cell">Instructor</th>
                <th class="border-0 fw-bold d-none d-lg-table-cell">Credits</th>
                <th class="border-0 fw-bold">Grade</th>
                <th class="border-0 fw-bold d-none d-sm-table-cell">Progress</th>
                <th class="border-0 fw-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              [All course table rows commented out for future use]
            </tbody>
          </table>
        </div>
        -->
      </div>
    </div>

    <!-- Assignments and Grades Grid -->
    <div class="row">
      <!-- Recent Assignments -->
      <div class="col-lg-6 mb-4">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Recent Assignments</h5>
          </div>
          <div class="card-body">
            <!-- TODO: Replace with actual assignment data when assignment system is implemented -->
            <!--
            <div class="assignment-item mb-3 p-3 border rounded">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="fw-bold mb-0">Assignment Title</h6>
                <span class="badge bg-danger">Due Date</span>
              </div>
              <p class="text-muted small mb-2">Course Code - Instructor Name</p>
              <div class="d-flex justify-content-between align-items-center">
                <div class="progress flex-grow-1 me-3" style="height: 6px;">
                  <div class="progress-bar" style="width: 0%"></div>
                </div>
                <small class="text-muted">Progress</small>
              </div>
            </div>
            -->
            <div class="text-center py-5">
              <i class="bi bi-list-check text-muted mb-3" style="font-size: 3rem;"></i>
              <h5 class="text-muted">No Assignments Available</h5>
              <p class="text-muted mb-0">Assignments will appear here when courses are active.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Grade Summary -->
      <div class="col-lg-6 mb-4">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Grade Summary</h5>
          </div>
          <div class="card-body">
            <!-- TODO: Replace with actual grade data when grading system is implemented -->
            <!--
            <div class="grade-item d-flex justify-content-between align-items-center py-2 border-bottom">
              <div>
                <div class="fw-bold">Course Name</div>
                <small class="text-muted">Course Code</small>
              </div>
              <div class="text-end">
                <div class="badge bg-success fs-6">Grade</div>
                <div class="small text-muted">GPA Points</div>
              </div>
            </div>
            -->
            <div class="text-center py-4">
              <i class="bi bi-graph-up text-muted mb-3" style="font-size: 3rem;"></i>
              <h5 class="text-muted">No Grades Available</h5>
              <p class="text-muted mb-4">Grade information will appear here when courses are completed.</p>
            </div>

            <div class="mt-4 p-3 bg-light rounded">
              <div class="row text-center">
                <div class="col-6">
                  <div class="fw-bold text-muted fs-4">-</div>
                  <div class="small text-muted">Current GPA</div>
                </div>
                <div class="col-6">
                  <div class="fw-bold text-muted fs-4">-</div>
                  <div class="small text-muted">Credits Earned</div>
                </div>
              </div>
            </div>

            <div class="text-center mt-3">
              <button class="btn btn-outline-secondary" disabled>View Full Transcript</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.academics {
  background-color: #f8f9fa;
  min-height: calc(100vh - 70px);
}

.assignment-item {
  transition: all 0.2s ease;
}

.assignment-item:hover {
  background-color: #f8f9fa;
}

.grade-item:last-child {
  border-bottom: none !important;
}
</style>