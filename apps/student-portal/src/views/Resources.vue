<script>
export default {
  name: 'Resources'
}
</script>

<template>
  <div class="resources p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
          <div class="mb-2 mb-md-0">
            <h2 class="h3 fw-bold text-dark mb-1">
              <i class="bi bi-collection me-2 text-primary"></i>
              Learning Resources
            </h2>
            <p class="text-muted mb-0">Access course materials, library resources, and digital content.</p>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-primary btn-sm" disabled>
              <i class="bi bi-search me-1"></i><span class="d-none d-sm-inline">Search Resources</span><span class="d-sm-none">Search</span>
            </button>
            <button class="btn btn-primary btn-sm" disabled>
              <i class="bi bi-cloud-upload me-1"></i><span class="d-none d-sm-inline">Upload File</span><span class="d-sm-none">Upload</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Access Cards -->
    <div class="row mb-4">
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div class="bg-primary bg-opacity-10 rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-book text-white fs-3"></i>
            </div>
            <h5 class="fw-bold">Course Materials</h5>
            <p class="text-muted small">Syllabus, lectures, handouts</p>
            <button class="btn btn-primary btn-sm" disabled>Access Now</button>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div class="bg-success bg-opacity-10 rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-journal-medical text-success fs-3"></i>
            </div>
            <h5 class="fw-bold">Digital Library</h5>
            <p class="text-muted small">E-books, journals, research papers</p>
            <button class="btn btn-success btn-sm" disabled>Browse Library</button>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div class="bg-warning bg-opacity-10 rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-camera-video text-warning fs-3"></i>
            </div>
            <h5 class="fw-bold">Video Lectures</h5>
            <p class="text-muted small">Recorded sessions, tutorials</p>
            <button class="btn btn-warning btn-sm" disabled>Watch Videos</button>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div class="bg-info bg-opacity-10 rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-tools text-info fs-3"></i>
            </div>
            <h5 class="fw-bold">Study Tools</h5>
            <p class="text-muted small">Flashcards, practice tests</p>
            <button class="btn btn-info btn-sm" disabled>Use Tools</button>
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <!-- Recent Downloads -->
      <div class="col-lg-8 mb-4">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap">
              <h5 class="fw-bold mb-0 mb-2 mb-md-0">Recent Downloads</h5>
              <div class="d-flex gap-2">
                <select class="form-select form-select-sm" style="width: auto;" disabled>
                  <option>All Courses</option>
                </select>
              </div>
            </div>
          </div>
          <div class="card-body">
            <!-- TODO: Replace with actual downloads table when resource management system is implemented -->
            <!-- 
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="border-0 fw-bold">File</th>
                    <th class="border-0 fw-bold d-none d-md-table-cell">Course</th>
                    <th class="border-0 fw-bold d-none d-lg-table-cell">Type</th>
                    <th class="border-0 fw-bold d-none d-sm-table-cell">Size</th>
                    <th class="border-0 fw-bold d-none d-md-table-cell">Downloaded</th>
                    <th class="border-0 fw-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  Mock data rows would go here
                </tbody>
              </table>
            </div>
            -->
            <div class="text-center py-5">
              <i class="bi bi-download text-muted mb-3" style="font-size: 3rem;"></i>
              <h5 class="text-muted">No Downloads Available</h5>
              <p class="text-muted mb-0">Resources and files will appear here when courses are active.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Resource Categories -->
      <div class="col-lg-4 mb-4">
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Resource Categories</h5>
          </div>
          <div class="card-body">
            <div class="list-group list-group-flush">
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-book me-2 text-primary"></i>
                  <span>Textbooks</span>
                </div>
                <span class="badge bg-secondary rounded-pill">0</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-file-earmark-pdf me-2 text-danger"></i>
                  <span>Lecture Notes</span>
                </div>
                <span class="badge bg-secondary rounded-pill">0</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-camera-video me-2 text-warning"></i>
                  <span>Video Lectures</span>
                </div>
                <span class="badge bg-secondary rounded-pill">0</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-journal-text me-2 text-success"></i>
                  <span>Research Papers</span>
                </div>
                <span class="badge bg-secondary rounded-pill">0</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-question-circle me-2 text-info"></i>
                  <span>Practice Tests</span>
                </div>
                <span class="badge bg-secondary rounded-pill">0</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Storage Usage -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Storage Usage</h5>
          </div>
          <div class="card-body">
            <div class="text-center mb-3">
              <div class="progress mx-auto mb-2" style="height: 8px; width: 200px;">
                <div class="progress-bar bg-secondary" style="width: 0%"></div>
              </div>
              <div class="fw-bold">0 MB of 1 GB used</div>
              <small class="text-muted">0% storage utilized</small>
            </div>
            
            <div class="row text-center">
              <div class="col-6">
                <div class="fw-bold text-muted">0</div>
                <small class="text-muted">Total Files</small>
              </div>
              <div class="col-6">
                <div class="fw-bold text-muted">0</div>
                <small class="text-muted">Folders</small>
              </div>
            </div>

            <div class="d-grid mt-3">
              <button class="btn btn-outline-primary" disabled>Manage Storage</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resources {
  background-color: #f8f9fa;
  min-height: calc(100vh - 70px);
}

.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-2px);
}

.list-group-item {
  transition: background-color 0.2s ease;
}

.list-group-item:hover {
  background-color: #f8f9fa;
}
</style>