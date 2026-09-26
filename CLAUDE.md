# hanmaum-dn-web-app — Arbeitsweise

Gilt für jede Session, Mensch oder Agent.

## Repo und Stack

Admin-Dashboard von hanmaum D+N. Backend ist `../hanmaum-dn-server`, der Keycloak-Realm wird mit `../hanmaum-dn-mobile-app` geteilt. Produktumfang: `../hanmaum-dn-ops/docs/MVP.md`.

- Angular 21, standalone Components, Signals
- PrimeNG 21, Tailwind CSS 3 (Tokens in `tailwind.config.js`)
- keycloak-js 26 (OAuth2/PKCE), RxJS, TypeScript strict
- `ng serve` auf :4200 leitet `/api` über `src/proxy.conf.json` an :8080 weiter, Keycloak läuft auf :8091

## Architektur

- `src/app/core/` enthält Services, Guards, Interceptor, Modelle und UI-Bausteine. `src/app/features/<domain>/` enthält je ein Fachgebiet.
- Keine Imports zwischen Features. Was geteilt wird, gehört nach `core/`.
- HTTP nur über `core/services/api.service.ts`, nie `HttpClient` in Components. Es entpackt `ApiResponse<T>`.
- Das JWT setzt `core/interceptors/jwt.interceptor.ts`. Keine eigenen Authorization-Header.
- Jede Datenroute läuft hinter `featureGuard('<FeatureId>')` (`core/guards/feature.guard.ts`). Wer was sehen darf, steht allein in der Rollenmatrix `FEATURE_ACCESS` (`core/navigation/feature-access.ts`); Navigation und Guard lesen dieselbe Zeile. Features werden lazy geladen.
- In URLs steht die `publicId` (UUID), nie die interne `id`.

## Figma ist Single Source of Truth für Design

- Datei **DN-Web**, fileKey `KSEMYc00jcgvyQ6qWt1cm4`, Seite `07 · Screens & Prototype`.
- Gibt es für ein Issue keinen Screen, wird er **zuerst in Figma** erstellt (Light und Dark), dann umgesetzt.
- Weicht der Issue-Text von Figma ab, gilt Figma. Die Abweichung im PR nennen.
- UI aus den Bausteinen in `src/app/core/ui/` bauen, Farben und Abstände nur über die Tokens (`tailwind.config.js`), keine Hex-Werte.

## Issue-first

1. Vor jeder Implementierung existiert ein GitHub-Issue.
2. Ein Branch pro Issue, abgezweigt von `dev` (z. B. `feat/statistics-60-figma`).
3. PR gegen `dev`, im Text `Closes #N`.
4. Issue immer mit Kommentaren lesen: `gh issue view <N> --json title,body,comments,labels`.
5. Labels: `type:bug`, `type:feature`, `type:chore` und `priority: high|medium|low`. Issues mit `needs-info` oder `in-progress` nicht aufnehmen.
6. Ist etwas unklar, nicht raten: `gh issue comment` mit der Frage, Label `needs-info` setzen, Issue liegen lassen.
7. Issues werden nie gelöscht, nur geschlossen (`gh issue close`, Board auf `Done`).
8. Gemerged wird nur mit ausdrücklichem OK des Users, nie eigenmächtig nach `dev` oder `main`.

## Board pflegen

Project #7 „DN WebApp“, gesetzt mit `scripts/issue-status.sh <N> "<Status>"`:

| Wann | Status |
| --- | --- |
| Arbeit beginnt | `In Progress` |
| PR ist offen | `In Review` |
| PR ist gemerged | `Done` |

## API-Vertrag

- Der Vertrag ist `hanmaum-dn-ops/api/openapi.yaml`. Der Server erzeugt ihn, das Web richtet sich danach und ändert ihn nie.
- Endpunkt **vor** der Nutzung dort prüfen.
- Fehlt er, ist das ein Server-Thema: Server-Issue anlegen bzw. umsetzen, danach im Server `./gradlew syncOpenApiToOps` (braucht Docker mit Postgres und Keycloak) und die Spec in ops committen.
- Nicht clientseitig nachbauen, was ein Endpunkt liefern müsste. Die Lücke im Issue kommentieren.

## Checks vor dem PR

```bash
npx ng lint
npx ng test --watch=false --browsers=ChromeHeadless
npx ng build
```

Texte gehen über ngx-translate: jeder neue Schlüssel in `public/i18n/ko.json` **und** `public/i18n/en.json`.

## Branches aufräumen

- Nach dem Merge den Branch lokal und remote löschen.
- **`dev` wird nie gelöscht.** Bei `dev → main`-PRs darauf achten, dass GitHubs „Automatically delete head branches“ ihn nicht mitnimmt.
