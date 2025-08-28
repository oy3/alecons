<script>
export default {
  name: "Settings",
  components: {},
};
</script>

<template>
  <div class="mt-3 p-5">
    <h5>Account</h5>
    <p class="small text-muted">Manage your profile</p>
    <hr />

    <div class="row">
      <div class="col-md-8">
        <div class="d-flex align-items-center mb-5">
          <img
            src="https://placehold.co/100"
            class="rounded-circle me-3"
            width="100"
            height="100"
          />
          <div>
            <h6>Profile picture</h6>
            <p class="small text-muted mb-0">PNG, JPG up to 5MB</p>
            <a
              class="small link-offset-2 link-offset-3-hover link-underline link-underline-opacity-0 link-underline-opacity-75-hover"
              href="#"
            >
              Update
            </a>
          </div>
        </div>

        <h6>Details</h6>
        <div class="mb-5 row g-3">
          <div class="col-md-6">
            <label for="exampleFormControlInput1" class="form-label small">
              First Name
            </label>
            <input
              type="email"
              class="form-control"
              id="exampleFormControlInput1"
              placeholder="Enter your first name"
            />
          </div>
          <div class="col-md-6">
            <label for="exampleFormControlInput1" class="form-label small">
              Last Name
            </label>
            <input
              type="email"
              class="form-control"
              id="exampleFormControlInput1"
              placeholder="Enter your last name"
            />
          </div>
          <div class="col-md-12">
            <label for="exampleFormControlInput1" class="form-label small">
              Email address
            </label>
            <input
              type="email"
              class="form-control"
              id="exampleFormControlInput1"
              placeholder="name@example.com"
            />
          </div>
        </div>

        <h6>Change Password</h6>
        <div class="mb-5 row g-3">
          <div class="col-md-12">
            <label for="exampleInputPassword1" class="form-label small">
              Current Password
            </label>
            <input
              type="password"
              class="form-control"
              id="exampleInputPassword1"
              placeholder="********"
            />
          </div>
          <div class="col-md-12">
            <label for="exampleInputPassword1" class="form-label small">
              New Password
            </label>
            <input
              type="password"
              class="form-control"
              id="exampleInputPassword1"
              placeholder="********"
            />
          </div>

          <button type="button" class="btn btn-acon-dark mt-5">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
