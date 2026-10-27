# AGENTS.md – hanmaum-dn-web-app

Projektregeln (Stack, Architektur, Figma, Issue-first, API-Vertrag) stehen in `CLAUDE.md` und gelten auch für Codex.

<!-- ai-dev-team:start -->
## KI-Entwicklungsteam

Dieses Repo wird vom KI-Entwicklungsteam GraceOps bearbeitet (Builder, Bezalel, Cornerstone, Shepherd; Entscheidungen: Jin).

- **Vor jeder Team-Aufgabe** den Skill `team-workflow` laden und `.team/config.yml` lesen.
- Projekt-Key: `HDN` · Board: GitHub Project #7 (SJinKim) · Rolle dieses Repos: web
- Verwandte Repos: `SJinKim/hanmaum-dn-server`, `SJinKim/hanmaum-dn-mobile-app`
- Architektur: `docs/architecture/` (overview, ADRs, patterns) – **vor jeder Implementierung lesen; Abweichungen nur per Entscheidungsvorlage.**
- Produktentscheidungen: `docs/product/decisions.md` – gelten verbindlich.
- Designs: Figma https://www.figma.com/design/KSEMYc00jcgvyQ6qWt1cm4/DN-Web · technische Feature-Designs in `docs/design/` bzw. im Issue.
- Erkenntnisse: `tasks/lessons.md` – vor der Arbeit überfliegen; `[lesson]`-Punkte aus Reviews hier eintragen.
- Basis-Branch ist `dev`: Worktrees von `origin/dev` abzweigen, PRs gegen `dev` (siehe „Issue-first“ in `CLAUDE.md`).
- Arbeit nur in eigenen Worktrees unter `../.worktrees/` – nie im Haupt-Checkout.
- Merge-bereit = Label `ready-to-merge`; gemergt wird nur von Jin (außer `auto_merge: true`).
- Produkt- und wichtige Technikentscheidungen trifft **nur Jin** (Skill `team-decision`).
- Lücken in Story/Design nie erfinden – nachfragen.

### Review guidelines
Für das Codex-GitHub-Review dieses Repos (nur Server-Repos, `codex_cloud_review` ≠ `off`):
- **P0/P1 (blockierend):** Sicherheitslücken (AuthN/AuthZ, IDOR, Injection, Secrets im Code/Log),
  Datenverlust, Verstöße gegen `docs/architecture/` (Schichten, Muster, ADRs), nicht erfüllte
  Akzeptanzkriterien des verlinkten Issues, fehlende Tests für neue Logik.
- **P2/P3:** Lesbarkeit, Fehlerbehandlung, Randfälle, kleinere Abweichungen.
- Keine Stil-Kommentare zu Dingen, die Linter prüfen.

### Befehle
- Build: `npx ng build` · Tests: `npx ng test --watch=false --browsers=ChromeHeadless` · Lint: `npx ng lint` · Architekturtests: – (noch keine)
- Lokal starten: `npx ng serve` (:4200, proxied `/api` → :8080, Keycloak :8091)
<!-- ai-dev-team:end -->
