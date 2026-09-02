# ALECONS Public Website

The public website is a Vue 3 and Vite application. Content shared across pages is kept in `src/data`, while reusable presentation components live in `src/components`.

## Commands

```bash
npm run dev --workspace=apps/website
npm run lint --workspace=apps/website
npm run test --workspace=apps/website
npm run build --workspace=apps/website
npm run preview --workspace=apps/website
```

The production build creates route-specific static HTML, a prerender manifest, `sitemap.xml`, and a dedicated `404.html`. The build fails when an indexable page is missing its title, description, canonical, social metadata, structured data, H1, or prerendered body.

## Production SEO

The Nginx server block must include the directives in `deployment/nginx-locations.conf.example`. They serve prerendered `.html` files at clean URLs, return real 404 statuses, and preserve the private verification route.

Set `VITE_GOOGLE_SITE_VERIFICATION` to the HTML-tag verification token supplied by Google Search Console. After deployment, submit `https://alecons.edu.ng/sitemap.xml` in Search Console.

After Nginx is updated and the website is deployed, run the production smoke check:

```bash
npm run verify:deployment --workspace=apps/website -- https://alecons.edu.ng
```

This checks prerendered metadata and content, `robots.txt`, the sitemap, the private verification response, and real HTTP 404 handling.

## Analytics

Umami is loaded only when `VITE_UMAMI_WEBSITE_ID` is configured. The integration:

- Tracks public SPA page views automatically.
- Excludes query strings, hashes, and `/verify/` paths.
- Respects browser Do Not Track preferences.
- Never sends contact-form values or user identifiers.
- Records a small set of conversion events for application, portal, WhatsApp, programme-application, social, and successful contact actions.

Production variables:

```dotenv
VITE_UMAMI_WEBSITE_ID="your-website-id"
VITE_UMAMI_SCRIPT_URL="https://cloud.umami.is/script.js"
VITE_UMAMI_DOMAINS="alecons.edu.ng,www.alecons.edu.ng"
VITE_UMAMI_ENABLE_PERFORMANCE="false"
```

Keep performance collection disabled initially to conserve free-tier events. Enable it after reviewing monthly usage. Do not enable session replay for pages that can display or collect personal information.

Umami Cloud's Hobby plan is free and intended for low-traffic sites. Umami counts page hits, custom events, and each stored event-data property toward usage, so the website intentionally sends only named conversion events without event properties. Review the current allowance in the Umami billing/usage screen because plan limits can change.

## Contact Form

The contact form posts to `/public/contact-enquiries` using the website's existing `VITE_API_BASE_URL` or `VITE_APP_API_URL`. No contact-specific endpoint variable is required.

The application also reads the existing website, API, and portal URL variables from the environment files used for each deployment mode.
