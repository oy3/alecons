<script lang="js">
import { useAuth, authManager } from "../../services/auth.js";
import { logger } from '@shared/utils/logger';

export default {
  name: "Settings",
    setup() {
    const { user, isAuthenticated, application } = useAuth();
    return {
      user,
      isAuthenticated,
      application
    };
  },
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
            <label for="settingsFirstName" class="form-label small">
              First Name
            </label>
            <input
              type="email"
              class="form-control"
              id="settingsFirstName"
              v-model="user.firstName"
              placeholder="Enter your first name"
              disabled
            />
          </div>
          <div class="col-md-6">
            <label for="settingsLastName" class="form-label small">
              Last Name
            </label>
            <input
              type="email"
              class="form-control"
              id="settingsLastName"
              v-model="user.lastName"
              placeholder="Enter your last name"
              disabled
            />
          </div>
          <div class="col-md-12">
            <label for="settingsEmail" class="form-label small">
              Email address
            </label>
            <input
              type="email"
              class="form-control"
              id="settingsEmail"
              v-model="user.email"
              placeholder="name@example.com"
              disabled
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
              id="exampleInputPassword2"
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
