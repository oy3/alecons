# ALECONS Public Website

The public website is a Vue 3 and Vite application. Content shared across pages is kept in `src/data`, while reusable presentation components live in `src/components`.

## Commands

```bash
npm run dev --workspace=apps/website
npm run lint --workspace=apps/website
npm run test --workspace=apps/website
npm run build --workspace=apps/website
```

## Contact Form

Set `VITE_CONTACT_FORM_ENDPOINT` to the future public contact endpoint. The form sends a JSON `POST` request. Until this variable is configured, valid submissions show the admissions email and phone fallback without pretending the enquiry was delivered.

The application also reads the existing website, API, and portal URL variables from the environment files used for each deployment mode.
