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
            <button class="btn btn-outline-primary btn-sm">
              <i class="bi bi-search me-1"></i><span class="d-none d-sm-inline">Search Resources</span><span class="d-sm-none">Search</span>
            </button>
            <button class="btn btn-primary btn-sm">
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
            <button class="btn btn-primary btn-sm">Access Now</button>
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
            <button class="btn btn-success btn-sm">Browse Library</button>
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
            <button class="btn btn-warning btn-sm">Watch Videos</button>
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
            <button class="btn btn-info btn-sm">Use Tools</button>
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
                <select class="form-select form-select-sm" style="width: auto;">
                  <option>All Courses</option>
                  <option>ANA 201</option>
                  <option>NUR 101</option>
                  <option>MED 150</option>
                </select>
              </div>
            </div>
          </div>
          <div class="card-body p-0">
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
                  <tr>
                    <td class="py-3">
                      <div class="d-flex align-items-center">
                        <i class="bi bi-file-earmark-pdf text-danger me-2 fs-5"></i>
                        <div>
                          <div class="fw-bold">Anatomy Chapter 5.pdf</div>
                          <small class="text-muted">Muscular System Overview</small>
                          <div class="d-md-none">
                            <small class="text-muted">
                              <span class="badge bg-primary badge-sm me-1">ANA 201</span>
                              Lecture Notes • 2.4 MB • 2h ago
                            </small>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="badge bg-primary">ANA 201</span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">Lecture Notes</td>
                    <td class="py-3 d-none d-sm-table-cell">2.4 MB</td>
                    <td class="py-3 d-none d-md-table-cell">2 hours ago</td>
                    <td class="py-3">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="View">
                          <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-success d-none d-sm-inline-block" title="Download">
                          <i class="bi bi-download"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3">
                      <div class="d-flex align-items-center">
                        <i class="bi bi-file-earmark-play text-warning me-2 fs-5"></i>
                        <div>
                          <div class="fw-bold">Nursing Skills Demo.mp4</div>
                          <small class="text-muted">Basic Patient Care Procedures</small>
                          <div class="d-md-none">
                            <small class="text-muted">
                              <span class="badge bg-success badge-sm me-1">NUR 101</span>
                              Video • 156 MB • 1d ago
                            </small>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="badge bg-success">NUR 101</span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">Video</td>
                    <td class="py-3 d-none d-sm-table-cell">156 MB</td>
                    <td class="py-3 d-none d-md-table-cell">1 day ago</td>
                    <td class="py-3">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="View">
                          <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-success d-none d-sm-inline-block" title="Download">
                          <i class="bi bi-download"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3">
                      <div class="d-flex align-items-center">
                        <i class="bi bi-file-earmark-text text-info me-2 fs-5"></i>
                        <div>
                          <div class="fw-bold">Medical Terms Quiz.docx</div>
                          <small class="text-muted">Practice Questions Set 1</small>
                          <div class="d-md-none">
                            <small class="text-muted">
                              <span class="badge bg-info badge-sm me-1">MED 150</span>
                              Assignment • 245 KB • 3d ago
                            </small>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="badge bg-info">MED 150</span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">Assignment</td>
                    <td class="py-3 d-none d-sm-table-cell">245 KB</td>
                    <td class="py-3 d-none d-md-table-cell">3 days ago</td>
                    <td class="py-3">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="View">
                          <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-success d-none d-sm-inline-block" title="Download">
                          <i class="bi bi-download"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
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
                <span class="badge bg-primary rounded-pill">24</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-file-earmark-pdf me-2 text-danger"></i>
                  <span>Lecture Notes</span>
                </div>
                <span class="badge bg-danger rounded-pill">67</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-camera-video me-2 text-warning"></i>
                  <span>Video Lectures</span>
                </div>
                <span class="badge bg-warning rounded-pill">43</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-journal-text me-2 text-success"></i>
                  <span>Research Papers</span>
                </div>
                <span class="badge bg-success rounded-pill">156</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                <div class="d-flex align-items-center">
                  <i class="bi bi-question-circle me-2 text-info"></i>
                  <span>Practice Tests</span>
                </div>
                <span class="badge bg-info rounded-pill">18</span>
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
                <div class="progress-bar bg-primary" style="width: 65%"></div>
              </div>
              <div class="fw-bold">650 MB of 1 GB used</div>
              <small class="text-muted">65% storage utilized</small>
            </div>
            
            <div class="row text-center">
              <div class="col-6">
                <div class="fw-bold text-primary">324</div>
                <small class="text-muted">Total Files</small>
              </div>
              <div class="col-6">
                <div class="fw-bold text-success">89</div>
                <small class="text-muted">Folders</small>
              </div>
            </div>

            <div class="d-grid mt-3">
              <button class="btn btn-outline-primary">Manage Storage</button>
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