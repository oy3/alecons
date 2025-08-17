<script>
export default {
  name: "Navbar"
};
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-white px-3">
    <div class="w-100 p-0 d-flex align-items-center justify-content-between">
      <!-- Mobile Sidebar Toggle -->
      <button
        class="btn d-md-none me-2"
        data-bs-toggle="offcanvas"
        data-bs-target="#mobileSidebar"
      >
        <i class="bi bi-list"></i>
      </button>

      <!-- Search + Right Icons -->
      <div class="d-flex align-items-center flex-grow-1 flex-md-grow-0 w-100">
        <!-- Search -->
        <form class="d-flex me-3 flex-grow-1 flex-md-grow-0 w-100 custom-search-width">
          <div class="input-group">
            <input
              type="text"
              class="form-control border-0 bg-light"
              placeholder="What do you need?"
            />
            <span class="input-group-text border-0">
              <i class="bi bi-search text-muted"></i>
            </span>
          </div>
        </form>

        <!-- Right Icons -->
        <div class="d-flex align-items-center ms-auto">
          <i class="bi bi-bell fs-5 me-3"></i>
          <img
            src="https://placehold.co/40?text=IMG"
            width="40"
            alt="Profile"
            class="rounded-circle me-2 border border-secondary"
          />
          <span class="fw-bold d-none d-sm-inline">John</span>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* Large screen: limit search bar width */
@media (min-width: 992px) {
  .custom-search-width {
    width: 350px !important;
  }
}

/* Small screen: make search full width */
@media (max-width: 991px) {
  .custom-search-width {
    width: 100% !important;
  }
}
</style>
