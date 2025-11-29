<script>
export default {
  name: 'Finance'
}
</script>

<template>
  <div class="finance p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
          <div class="mb-2 mb-md-0">
            <h2 class="h3 fw-bold text-dark mb-1">
              <i class="bi bi-credit-card me-2 text-primary"></i>
              Financial Dashboard
            </h2>
            <p class="text-muted mb-0">Manage your tuition, fees, and payment history.</p>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-primary btn-sm">
              <i class="bi bi-download me-1"></i><span class="d-none d-sm-inline">Export Statement</span><span class="d-sm-none">Export</span>
            </button>
            <button class="btn btn-success btn-sm">
              <i class="bi bi-credit-card me-1"></i><span class="d-none d-sm-inline">Make Payment</span><span class="d-sm-none">Pay</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Financial Summary Cards -->
    <div class="row mb-4">
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-success bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-check-circle text-success fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Account Bal</h6>
                <h4 class="fw-bold text-success mb-0">₦0</h4>
                <small class="text-success">All payments current</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-primary bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-currency-exchange text-white fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Total Paid</h6>
                <h4 class="fw-bold text-primary mb-0">₦485,000</h4>
                <small class="text-muted">This academic year</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-warning bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-clock text-warning fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Pending</h6>
                <h4 class="fw-bold text-warning mb-0">₦45,000</h4>
                <small class="text-muted">Accommodation fee</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <div class="bg-info bg-opacity-10 rounded-3 p-3">
                  <i class="bi bi-calendar-check text-info fs-4"></i>
                </div>
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="fw-bold text-dark mb-1">Next Due</h6>
                <h4 class="fw-bold text-info mb-0">Jan 15</h4>
                <small class="text-muted">Spring semester</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <!-- Payment History -->
      <div class="col-lg-8 mb-4">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap">
              <h5 class="fw-bold mb-0 mb-2 mb-md-0">Payment History</h5>
              <div class="d-flex gap-2">
                <select class="form-select form-select-sm" style="width: auto;">
                  <option>2024-2025</option>
                  <option>2023-2024</option>
                  <option>2022-2023</option>
                </select>
                <button class="btn btn-sm btn-outline-secondary">
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
                    <th class="border-0 fw-bold">Transaction</th>
                    <th class="border-0 fw-bold d-none d-md-table-cell">Amount</th>
                    <th class="border-0 fw-bold">Status</th>
                    <th class="border-0 fw-bold d-none d-lg-table-cell">Reference</th>
                    <th class="border-0 fw-bold d-none d-sm-table-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="py-3">
                      <div>
                        <div class="fw-bold">Tuition Fee - Fall 2024</div>
                        <small class="text-muted">Academic semester fee</small>
                        <div class="d-md-none">
                          <small class="text-muted">
                            Nov 15, 2024 • ₦280,000 • PAY-2024-001156
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="fw-bold text-success">₦280,000</span>
                    </td>
                    <td class="py-3">
                      <span class="badge bg-success">Paid</span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">
                      <code class="small">PAY-2024-001156</code>
                    </td>
                    <td class="py-3 d-none d-sm-table-cell">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="View Receipt">
                          <i class="bi bi-receipt"></i>
                        </button>
                        <button class="btn btn-outline-secondary" title="Download">
                          <i class="bi bi-download"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3">
                      <div>
                        <div class="fw-bold">Registration Fee</div>
                        <small class="text-muted">Course registration</small>
                        <div class="d-md-none">
                          <small class="text-muted">
                            Oct 22, 2024 • ₦15,000 • PAY-2024-001098
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="fw-bold text-success">₦15,000</span>
                    </td>
                    <td class="py-3">
                      <span class="badge bg-success">Paid</span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">
                      <code class="small">PAY-2024-001098</code>
                    </td>
                    <td class="py-3 d-none d-sm-table-cell">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="View Receipt">
                          <i class="bi bi-receipt"></i>
                        </button>
                        <button class="btn btn-outline-secondary" title="Download">
                          <i class="bi bi-download"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3">
                      <div>
                        <div class="fw-bold">Library Fee</div>
                        <small class="text-muted">Annual library access</small>
                        <div class="d-md-none">
                          <small class="text-muted">
                            Sep 10, 2024 • ₦8,000 • PAY-2024-000876
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="fw-bold text-success">₦8,000</span>
                    </td>
                    <td class="py-3">
                      <span class="badge bg-success">Paid</span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">
                      <code class="small">PAY-2024-000876</code>
                    </td>
                    <td class="py-3 d-none d-sm-table-cell">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="View Receipt">
                          <i class="bi bi-receipt"></i>
                        </button>
                        <button class="btn btn-outline-secondary" title="Download">
                          <i class="bi bi-download"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr class="table-warning">
                    <td class="py-3">
                      <div>
                        <div class="fw-bold">Accommodation Fee</div>
                        <small class="text-muted">Hostel accommodation - Spring 2025</small>
                        <div class="d-md-none">
                          <small class="text-muted">
                            Pending • ₦45,000 • Due soon
                          </small>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 d-none d-md-table-cell">
                      <span class="fw-bold text-warning">₦45,000</span>
                    </td>
                    <td class="py-3">
                      <span class="badge bg-warning">Pending</span>
                    </td>
                    <td class="py-3 d-none d-lg-table-cell">
                      <small class="text-muted">Not generated</small>
                    </td>
                    <td class="py-3 d-none d-sm-table-cell">
                      <button class="btn btn-sm btn-success">
                        <i class="bi bi-credit-card me-1"></i>Pay Now
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="col-lg-4">
        <!-- Payment Summary -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Payment Summary</h5>
          </div>
          <div class="card-body">
            <div class="payment-summary-item d-flex justify-content-between py-2 border-bottom">
              <span class="text-muted">Tuition (Fall 2024)</span>
              <span class="fw-bold">₦280,000</span>
            </div>
            <div class="payment-summary-item d-flex justify-content-between py-2 border-bottom">
              <span class="text-muted">Registration Fee</span>
              <span class="fw-bold">₦15,000</span>
            </div>
            <div class="payment-summary-item d-flex justify-content-between py-2 border-bottom">
              <span class="text-muted">Library Fee</span>
              <span class="fw-bold">₦8,000</span>
            </div>
            <div class="payment-summary-item d-flex justify-content-between py-2 border-bottom">
              <span class="text-muted">Medical Insurance</span>
              <span class="fw-bold">₦12,000</span>
            </div>
            <div class="payment-summary-item d-flex justify-content-between py-3 bg-light rounded mt-2">
              <span class="fw-bold">Total Paid</span>
              <span class="fw-bold text-success fs-5">₦315,000</span>
            </div>
            <div class="payment-summary-item d-flex justify-content-between py-2 text-warning">
              <span class="fw-bold">Outstanding</span>
              <span class="fw-bold">₦45,000</span>
            </div>
          </div>
        </div>

        <!-- Payment Methods -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Payment Methods</h5>
          </div>
          <div class="card-body">
            <div class="d-grid gap-2">
              <button class="btn btn-primary d-flex align-items-center justify-content-between">
                <span>
                  <i class="bi bi-credit-card me-2"></i>
                  Debit/Credit Card
                </span>
                <i class="bi bi-arrow-right"></i>
              </button>
              <button class="btn btn-outline-success d-flex align-items-center justify-content-between">
                <span>
                  <i class="bi bi-bank me-2"></i>
                  Bank Transfer
                </span>
                <i class="bi bi-arrow-right"></i>
              </button>
              <button class="btn btn-outline-info d-flex align-items-center justify-content-between">
                <span>
                  <i class="bi bi-phone me-2"></i>
                  Mobile Payment
                </span>
                <i class="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white border-0 py-3">
            <h5 class="fw-bold mb-0">Quick Actions</h5>
          </div>
          <div class="card-body">
            <div class="d-grid gap-2">
              <button class="btn btn-outline-primary">
                <i class="bi bi-receipt me-2"></i>View All Receipts
              </button>
              <button class="btn btn-outline-secondary">
                <i class="bi bi-file-earmark-pdf me-2"></i>Fee Structure
              </button>
              <button class="btn btn-outline-info">
                <i class="bi bi-question-circle me-2"></i>Payment Help
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.finance {
  background-color: #f8f9fa;
  min-height: calc(100vh - 70px);
}

.payment-summary-item:last-child.border-bottom {
  border-bottom: none !important;
}

.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-2px);
}

.table-warning {
  background-color: rgba(255, 193, 7, 0.1);
}

code {
  background-color: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.875em;
}
</style>