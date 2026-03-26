# ALECONS Automated Production Deployment

This document describes the GitHub Actions based production deployment flow for the ALECONS monorepo.

## Overview

Production deployments are triggered when code is pushed or merged into the `production` branch.

The deployment flow is intentionally split into two parts:

1. **Frontends are built in GitHub Actions** and only the generated `dist` artifacts are uploaded to the droplet.
2. **The API source is uploaded to the droplet** and built there with runtime secrets loaded from the server.

This keeps production secrets off Git, removes manual FileZilla uploads, and makes deployments repeatable.

## Current Production Paths

The deploy scripts assume the following live paths on the droplet:

- Website: `/home/apps/website`
- Application portal: `/home/apps/application-portal`
- CBT: `/home/apps/cbt`
- Staff portal: `/home/apps/staff-portal`
- Student portal: `/home/apps/student-portal`
- API releases root: `/home/api/releases`
- API current symlink: `/home/api/current`

## Repository Files Added For CI/CD

- `.github/workflows/deploy-production.yml`
- `scripts/deploy/render-frontend-envs.sh`
- `scripts/deploy/remote-deploy.sh`
- `scripts/deploy/prepare-droplet.sh`
- `packages/api/ecosystem.config.cjs`
- per-app `.env.example` files

## Phase 1: Security Cleanup

Before turning on automated deployments:

1. Move production API secrets out of the repository.
2. Keep the real runtime API env file only on the droplet at `/etc/alecons/api.env`.
3. Rotate any secrets that were previously committed or shared insecurely.
4. Commit a root `package-lock.json` in a follow-up change so GitHub Actions can use `npm ci` consistently.

## Phase 2: Prepare the Droplet

### 1. Create a deploy user and directories

Run on the Ubuntu droplet as `root` or with `sudo`.

Do not run this script on your MacBook; it prepares Linux users and directories on the server.

If this repo is not yet cloned on the droplet, either clone it there first or copy `scripts/deploy/prepare-droplet.sh` to the server and run it from there.

```bash
ssh root@142.93.37.237
cd /path/to/your/repo
sudo bash scripts/deploy/prepare-droplet.sh
```

If your deploy user should be something other than `deploy`, run:

```bash
sudo DEPLOY_USER=youruser bash scripts/deploy/prepare-droplet.sh
```

### 2. Add the GitHub Actions SSH key

Generate an SSH key pair locally or in a secure admin machine:

```bash
ssh-keygen -t ed25519 -C "github-actions-alecons-production"
```

- Put the **private key** into GitHub secret `DROPLET_SSH_KEY`
- Append the **public key** to `/home/deploy/.ssh/authorized_keys` on the droplet

### 3. Create the API runtime env file

On the droplet:

```bash
sudo mkdir -p /etc/alecons
sudo nano /etc/alecons/api.env
```

Use `packages/api/.env.example` as the template, but put the real production values in `/etc/alecons/api.env` only.

## Phase 3: Configure GitHub

Create a GitHub **Environment** named `production`.

### GitHub Secrets

Add these as **Environment Secrets**:

- `DROPLET_HOST` = `142.93.37.237`
- `DROPLET_USER` = your deploy SSH user, ideally `deploy`
- `DROPLET_PORT` = `22` (or your custom SSH port)
- `DROPLET_SSH_KEY` = private SSH key for the deploy user

### GitHub Variables

Add these as **Environment Variables**:

- `VITE_APP_FULL_NAME` = `Alecons College of Nursing Sciences`
- `VITE_APP_SITE_URL` = `https://alecons.edu.ng`
- `VITE_APP_PHONE` = your public admissions phone number
- `VITE_APP_APPLICATION_PORTAL_URL` = `https://apply.alecons.edu.ng`
- `VITE_APP_STUDENT_PORTAL_URL` = `https://portal.alecons.edu.ng`
- `VITE_APP_STAFF_PORTAL_URL` = `https://staff.alecons.edu.ng`
- `VITE_APP_API_URL` = `https://api.alecons.edu.ng/api/v1`
- `VITE_PAYSTACK_PUBLIC_KEY` = your live public Paystack key
- `VITE_APP_ENV` = `production`
- `VITE_APP_DEBUG` = `false`
- `VITE_CBT_APP_NAME` = `ALECONS CBT`
- `VITE_APP_VERSION` = `1.0.0`
- `VITE_LOG_LEVEL` = `info`
- `VITE_ENABLE_DEV_TOOLS` = `false`

The workflow derives `VITE_API_URL`, `VITE_API_BASE_URL`, and `VITE_SOCKET_URL` automatically from `VITE_APP_API_URL`, so you do not need to enter those separately in GitHub.

## Phase 4: How The Workflow Runs

When the workflow runs:

1. installs workspace dependencies
2. generates `.env.production` for the frontend apps from GitHub variables
3. builds the frontend apps in CI
4. validates the API build in CI
5. uploads `frontend-dist.tar.gz` and `api-release.tar.gz` to the droplet
6. runs `scripts/deploy/remote-deploy.sh` on the droplet
7. copies fresh frontend builds into `/home/apps/*`
8. extracts the API release into `/home/api/releases/<commit-sha>`
9. installs API dependencies and builds the API on the droplet
10. updates `/home/api/current` to the new release
11. reloads PM2 using `packages/api/ecosystem.config.cjs`
12. verifies the API health endpoint

The remote deploy script sets `NODE_OPTIONS=--max-old-space-size=2048` during the API build by default. If your droplet has more RAM and you need a larger heap, set `API_BUILD_NODE_OPTIONS` before invoking the remote deploy script.

## Phase 5: First Deployment Run

1. Commit and push this CI/CD scaffolding.
2. Configure the GitHub environment secrets and variables.
3. Ensure nginx is already pointing to the correct `.edu.ng` frontend folders and API reverse proxy.
4. Ensure `/etc/alecons/api.env` exists on the droplet.
5. Merge into or push to the `production` branch.
6. Watch the workflow in GitHub Actions.

## Manual Rollback

To roll back the API on the droplet:

```bash
ls -1dt /home/api/releases/*
ln -sfn /home/api/releases/<older-release> /home/api/current
set -a
source /etc/alecons/api.env
set +a
export ALECONS_API_CWD=/home/api/current
pm2 startOrReload /home/api/current/ecosystem.config.cjs --update-env
```

To roll back a frontend:

- copy the previous release contents from `~/releases/acons/<release-id>/` back into the matching `/home/apps/...` directory
- or re-run the workflow with the desired commit

## Day-2 Operations

### Verify deployment

```bash
curl -I https://alecons.edu.ng
curl -I https://apply.alecons.edu.ng
curl -I https://portal.alecons.edu.ng
curl -I https://staff.alecons.edu.ng
curl -I https://cbt.alecons.edu.ng
curl https://api.alecons.edu.ng/api/v1/health
```

### Watch PM2 logs

```bash
pm2 status
pm2 logs alecons-api --lines 100
```

### If API build fails with JavaScript heap out of memory

- This happens on the droplet, not on the GitHub runner.
- The deploy script already raises the Node heap for the API build to `2048MB`.
- If the droplet is still too small, add swap or upgrade the droplet RAM.
- As a temporary override, run the remote deploy with a larger heap, for example `API_BUILD_NODE_OPTIONS=--max-old-space-size=3072`.

### Clean up old releases manually

The remote deploy script keeps the latest 5 releases by default.

To change that behavior, set `KEEP_RELEASES` when invoking the remote deploy script.

## Recommended Next Improvements

1. Commit a root `package-lock.json` and switch the workflow fully to `npm ci`
2. Add a smoke-test job before deploy
3. Add path-based deploy optimization so unchanged apps are skipped
4. Add a manual rollback workflow
5. Move API deployment to a fully built artifact if you want completely reproducible backend releases too
