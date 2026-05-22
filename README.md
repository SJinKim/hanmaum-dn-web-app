# dn-app-dashboard

Web admin dashboard for **Hanmaum D+N** church management.

Requires the backend (`../dn-app`) and Keycloak (`../dn-app/infrastructure/docker-compose.yml`) to be running.

## Setup

```bash
npm install
ng serve          # http://localhost:4200
```

## Related repos

| Repo | Role |
| --- | --- |
| `../dn-app` | Backend API + infrastructure |
| `../HanmaumDnApp` | Mobile app (shared auth realm) |
