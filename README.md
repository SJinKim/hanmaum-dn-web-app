# dn-app-dashboard

Web admin dashboard for **Hanmaum D+N** church management.

Requires the backend (`../dn-app`) and Keycloak (`../dn-app/infrastructure/docker-compose.yml`) to be running.

## Workflow

How work is done in this repo (Figma first, issue-first, board, API contract, checks): see [`CLAUDE.md`](CLAUDE.md).

## Setup

```bash
npm install
ng serve          # http://localhost:4200
```

## Vercel build variables

`npm run build` runs `scripts/generate-vercel-env.mjs` first, which writes `src/environments/environment.prod.ts` from these variables:

| Value | Variables, first one set wins |
| --- | --- |
| API base URL | `API_BASE_URL`, then `https://<API_DOMAIN>/api`, else `/api` |
| Keycloak URL | `KEYCLOAK_URL`, then the host of `APP_SECURITY_KEYCLOAK_PUBLIC_ISSUER`, then `AUTH_DOMAIN` |
| Realm | `KEYCLOAK_REALM`, then the realm in the issuer, else `hanmaum` |
| Client ID | `KEYCLOAK_CLIENT_ID`, else `hanmaum-dashboard` |

For a preview build (`VERCEL_ENV=preview`), each variable is read as `STAGING_<NAME>` first. A preview build that still resolves to the prod API host or a `-prod` realm fails. Test with `npm run test:scripts`.

## Related repos

| Repo | Role |
| --- | --- |
| `../dn-app` | Backend API + infrastructure |
| `../HanmaumDnApp` | Mobile app (shared auth realm) |
