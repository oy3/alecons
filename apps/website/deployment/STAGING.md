# ALECONS Website Staging

`staging.alecons.com.ng` is an isolated preview environment for the public website. A push to the `staging` branch builds and deploys only `apps/website`. The existing production workflow continues to deploy the complete platform from `production`; staging does not deploy or restart the API or any portal.

## Deployment layout

```text
/home/rootlab/apps/alecons/staging/website/
├── current -> releases/<git-sha>
└── releases/<git-sha>/
```

The five newest releases are retained. Nginx serves the `current` symlink, making activation and rollback atomic.

## 1. Create DNS

Create this record in the `alecons.com.ng` DNS zone:

```text
Type: A
Name: staging
Value: <production-droplet-public-IP>
TTL: 300
```

Wait for it to resolve:

```bash
dig +short staging.alecons.com.ng
```

## 2. Prepare the droplet

SSH into the droplet and run:

```bash
sudo install -d -m 755 -o rootlab -g rootlab \
  /home/rootlab/apps/alecons/staging/website/releases
sudo install -d -m 755 /var/www/html/.well-known/acme-challenge

sudo apt-get update
sudo apt-get install -y apache2-utils
sudo htpasswd -cB /etc/nginx/.htpasswd-alecons-staging rootlab
```

Keep the Basic Auth password for the GitHub Environment secret. Do not store it in a repository variable or file.

## 3. Obtain TLS

Create a temporary HTTP-only configuration:

```bash
sudo nano /etc/nginx/sites-available/staging.alecons.com.ng
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name staging.alecons.com.ng;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 200 "ALECONS staging is being configured.\n";
        add_header Content-Type text/plain;
    }
}
```

Enable it and obtain the certificate:

```bash
sudo ln -s /etc/nginx/sites-available/staging.alecons.com.ng \
  /etc/nginx/sites-enabled/staging.alecons.com.ng
sudo nginx -t
sudo systemctl reload nginx

sudo certbot certonly --webroot \
  -w /var/www/html \
  -d staging.alecons.com.ng
```

Replace the temporary configuration with `staging.alecons.com.ng.conf.example`, then run:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Before the first deployment, HTTPS may return 404 because the `current` release does not exist yet. This is expected.

## 4. Create the GitHub Environment

Open **GitHub → Repository Settings → Environments → New environment** and create `staging`.

Add these Environment secrets:

| Secret | Value |
| --- | --- |
| `ROOTLAB_DEPLOY_HOST` | Droplet hostname or IP |
| `ROOTLAB_DEPLOY_USER` | `rootlab` |
| `ROOTLAB_DEPLOY_PORT` | SSH port, normally `22` |
| `ROOTLAB_SSH_PRIVATE_KEY` | Existing deployment private key |
| `STAGING_BASIC_AUTH_PASSWORD` | Password entered using `htpasswd` |

Add these Environment variables:

| Variable | Value |
| --- | --- |
| `ROOTLAB_STAGING_WEBSITE_ROOT` | `/home/rootlab/apps/alecons/staging/website` |
| `STAGING_BASIC_AUTH_USERNAME` | `rootlab` |
| `VITE_APP_API_URL` | `https://api.alecons.edu.ng/api/v1` |
| `VITE_API_BASE_URL` | `https://api.alecons.edu.ng/api/v1` |
| `VITE_APP_APPLICATION_PORTAL_URL` | `https://apply.alecons.edu.ng` |
| `VITE_APP_STUDENT_PORTAL_URL` | `https://portal.alecons.edu.ng` |
| `VITE_APP_STAFF_PORTAL_URL` | `https://staff.alecons.edu.ng` |
| `VITE_CONTACT_FORM_ENDPOINT` | Do not create until the endpoint exists |
| `VITE_UMAMI_WEBSITE_ID` | Do not create, or use a separate staging Umami website ID |

The workflow sets `VITE_SITE_NOINDEX=true`, disables Google verification and performance analytics, restricts any staging Umami tracker to the staging hostname, and preserves production canonical/schema URLs for QA.

Do not use `-`, `none`, or another placeholder for an optional Vite variable. An unset variable must be absent; otherwise its placeholder is compiled into the application as a real value.

Optional: configure required reviewers on the GitHub Environment if staging deployments need manual approval.

## 5. Branch and deployment flow

```text
feature/website-v2 → pull request → staging → automatic staging deployment
staging → pull request → production → automatic production deployment
```

The existing `.github/workflows/deploy-production.yml` listens to `production`. The new `.github/workflows/deploy-staging.yml` listens to `staging` and deploys only Website V2.

Check branches before creating anything:

```bash
git status
git fetch origin
git branch -a
```

If `staging` does not exist, create it from the approved Website V2 commit. Ensure the first push contains the staging workflow:

```bash
git switch -c staging
git push -u origin staging
```

For subsequent releases, merge approved `feature/website-v2` changes into `staging`. A manual run is also available under **Actions → Deploy Staging → Run workflow**.

The repository currently has no root lockfile. The workflow therefore uses `npm install --no-package-lock`; if a reviewed lockfile is restored later, it automatically switches to `npm ci` for reproducible installs.

## 6. First deployment checks

Watch **Actions → Deploy Staging** until every step passes. Then run locally:

```bash
BASIC_AUTH_USERNAME=rootlab \
BASIC_AUTH_PASSWORD='<staging-password>' \
EXPECT_NOINDEX=true \
npm run verify:deployment --workspace=apps/website -- \
  https://staging.alecons.com.ng
```

Manual checks:

```bash
curl -u rootlab:'<staging-password>' -I \
  https://staging.alecons.com.ng/about

curl -u rootlab:'<staging-password>' \
  https://staging.alecons.com.ng/robots.txt
```

Expected:

- `/about` returns `200` after authentication.
- Responses and HTML contain `noindex`.
- `robots.txt` contains `Disallow: /`.
- Unknown URLs return `404`.
- Production remains unchanged.

## 7. Rollback

List retained releases:

```bash
ls -1dt /home/rootlab/apps/alecons/staging/website/releases/*
```

Activate a known-good release:

```bash
STAGING_ROOT=/home/rootlab/apps/alecons/staging/website
ROLLBACK_RELEASE="$STAGING_ROOT/releases/<git-sha>"
ln -s "$ROLLBACK_RELEASE" "$STAGING_ROOT/.rollback-current"
mv -Tf "$STAGING_ROOT/.rollback-current" "$STAGING_ROOT/current"
```

No Nginx reload is needed. The deployment workflow and remote script reject any staging path that does not contain `/staging/`, preventing an accidental production overwrite.
