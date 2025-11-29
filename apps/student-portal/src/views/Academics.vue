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
            <button class="btn btn-outline-primary btn-sm">
              <i class="bi bi-download me-1"></i><span class="d-none d-sm-inline">Export Transcript</span><span class="d-sm-none">Export</span>
            </button>
            <button class="btn btn-primary btn-sm">
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
            <h4 class="fw-bold text-primary">3.85</h4>
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
            <h4 class="fw-bold text-success">6</h4>
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
            <h4 class="fw-bold text-warning">3</h4>
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
            <h4 class="fw-bold text-info">92%</h4>
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
            <select class="form-select form-select-sm" style="width: auto;">
              <option>Fall 2024</option>
              <option>Spring 2024</option>
              <option>Summer 2024</option>
            </select>
            <button class="btn btn-sm btn-outline-light">
              <i class="bi bi-funnel"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="card-body p-0">
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
              <tr>
                <td class="py-3">
                  <div>
                    <div class="d-flex align-items-center">
                      <span class="badge bg-primary me-2">ANA 201</span>
                      <div>
                        <div class="fw-bold">Anatomy & Physiology</div>
                        <small class="text-muted d-md-none">Dr. Sarah Johnson • 4 credits</small>
                        <small class="text-muted d-none d-md-block">Advanced human body systems</small>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="py-3 d-none d-md-table-cell">Dr. Sarah Johnson</td>
                <td class="py-3 d-none d-lg-table-cell">4</td>
                <td class="py-3">
                  <span class="badge bg-success">A</span>
                </td>
                <td class="py-3 d-none d-sm-table-cell">
                  <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-success" style="width: 85%"></div>
                  </div>
                  <small class="text-muted">85%</small>
                </td>
                <td class="py-3">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-sm">
                      <i class="bi bi-eye d-sm-none"></i>
                      <span class="d-none d-sm-inline">View</span>
                    </button>
                    <button class="btn btn-outline-secondary btn-sm d-none d-sm-inline-block">Materials</button>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="py-3">
                  <div>
                    <div class="d-flex align-items-center">
                      <span class="badge bg-success me-2">NUR 101</span>
                      <div>
                        <div class="fw-bold">Fundamentals of Nursing</div>
                        <small class="text-muted d-md-none">Prof. Michael Brown • 3 credits</small>
                        <small class="text-muted d-none d-md-block">Basic nursing principles and practices</small>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="py-3 d-none d-md-table-cell">Prof. Michael Brown</td>
                <td class="py-3 d-none d-lg-table-cell">3</td>
                <td class="py-3">
                  <span class="badge bg-success">A-</span>
                </td>
                <td class="py-3 d-none d-sm-table-cell">
                  <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-primary" style="width: 72%"></div>
                  </div>
                  <small class="text-muted">72%</small>
                </td>
                <td class="py-3">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-sm">
                      <i class="bi bi-eye d-sm-none"></i>
                      <span class="d-none d-sm-inline">View</span>
                    </button>
                    <button class="btn btn-outline-secondary btn-sm d-none d-sm-inline-block">Materials</button>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="py-3">
                  <div>
                    <div class="d-flex align-items-center">
                      <span class="badge bg-info me-2">MED 150</span>
                      <div>
                        <div class="fw-bold">Medical Terminology</div>
                        <small class="text-muted d-md-none">Dr. Emily Davis • 2 credits</small>
                        <small class="text-muted d-none d-md-block">Healthcare vocabulary and language</small>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="py-3 d-none d-md-table-cell">Dr. Emily Davis</td>
                <td class="py-3 d-none d-lg-table-cell">2</td>
                <td class="py-3">
                  <span class="badge bg-warning">B+</span>
                </td>
                <td class="py-3 d-none d-sm-table-cell">
                  <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-warning" style="width: 68%"></div>
                  </div>
                  <small class="text-muted">68%</small>
                </td>
                <td class="py-3">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-sm">
                      <i class="bi bi-eye d-sm-none"></i>
                      <span class="d-none d-sm-inline">View</span>
                    </button>
                    <button class="btn btn-outline-secondary btn-sm d-none d-sm-inline-block">Materials</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
            <div class="assignment-item mb-3 p-3 border rounded">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="fw-bold mb-0">Case Study Analysis</h6>
                <span class="badge bg-danger">Due Tomorrow</span>
              </div>
              <p class="text-muted small mb-2">ANA 201 - Dr. Sarah Johnson</p>
              <div class="d-flex justify-content-between align-items-center">
                <div class="progress flex-grow-1 me-3" style="height: 6px;">
                  <div class="progress-bar bg-danger" style="width: 30%"></div>
                </div>
                <small class="text-muted">30% Complete</small>
              </div>
            </div>

            <div class="assignment-item mb-3 p-3 border rounded">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="fw-bold mb-0">Lab Report - Vital Signs</h6>
                <span class="badge bg-warning">Due Dec 5</span>
              </div>
              <p class="text-muted small mb-2">NUR 101 - Prof. Michael Brown</p>
              <div class="d-flex justify-content-between align-items-center">
                <div class="progress flex-grow-1 me-3" style="height: 6px;">
                  <div class="progress-bar bg-warning" style="width: 60%"></div>
                </div>
                <small class="text-muted">60% Complete</small>
              </div>
            </div>

            <div class="assignment-item mb-3 p-3 border rounded">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="fw-bold mb-0">Chapter 5 Quiz</h6>
                <span class="badge bg-success">Completed</span>
              </div>
              <p class="text-muted small mb-2">MED 150 - Dr. Emily Davis</p>
              <div class="d-flex justify-content-between align-items-center">
                <div class="text-success small">
                  <i class="bi bi-check-circle me-1"></i>Score: 95%
                </div>
              </div>
            </div>

            <div class="text-center">
              <button class="btn btn-outline-primary">View All Assignments</button>
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
            <div class="grade-item d-flex justify-content-between align-items-center py-2 border-bottom">
              <div>
                <div class="fw-bold">Anatomy & Physiology</div>
                <small class="text-muted">ANA 201</small>
              </div>
              <div class="text-end">
                <div class="badge bg-success fs-6">A</div>
                <div class="small text-muted">4.0 GPA</div>
              </div>
            </div>

            <div class="grade-item d-flex justify-content-between align-items-center py-2 border-bottom">
              <div>
                <div class="fw-bold">Fundamentals of Nursing</div>
                <small class="text-muted">NUR 101</small>
              </div>
              <div class="text-end">
                <div class="badge bg-success fs-6">A-</div>
                <div class="small text-muted">3.7 GPA</div>
              </div>
            </div>

            <div class="grade-item d-flex justify-content-between align-items-center py-2 border-bottom">
              <div>
                <div class="fw-bold">Medical Terminology</div>
                <small class="text-muted">MED 150</small>
              </div>
              <div class="text-end">
                <div class="badge bg-warning fs-6">B+</div>
                <div class="small text-muted">3.3 GPA</div>
              </div>
            </div>

            <div class="mt-4 p-3 bg-light rounded">
              <div class="row text-center">
                <div class="col-6">
                  <div class="fw-bold text-primary fs-4">3.85</div>
                  <div class="small text-muted">Current GPA</div>
                </div>
                <div class="col-6">
                  <div class="fw-bold text-success fs-4">15</div>
                  <div class="small text-muted">Credits Earned</div>
                </div>
              </div>
            </div>

            <div class="text-center mt-3">
              <button class="btn btn-outline-primary">View Full Transcript</button>
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