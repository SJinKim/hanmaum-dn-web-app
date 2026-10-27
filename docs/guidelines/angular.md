# Angular-Richtlinien

Diese Richtlinien konkretisieren die bestehenden Projektregeln für Feature-Designs und
Reviews. Stand: Angular 21 / PrimeNG 21 auf `dev`, Oktober 2026. Maßgeblich sind außerdem
die [Projektregeln](../../CLAUDE.md) und [Produktentscheidungen](../product/decisions.md).
Die Abschnitte unterscheiden vorhandene Umsetzung und Regeln für neue Änderungen;
bestehende Abweichungen sind kein Auftrag für einen nebenläufigen Umbau.

## Verweise

Stabile Abschnittslinks für Feature-Designs:
[Feature-Ordner](#feature-ordner), [Komponenten](#komponenten), [Services](#services),
[Routing](#routing), [State](#state), [Formulare](#formulare),
[Design-System](#design-system), [Tests](#tests), [Pruefbefehle](#pruefbefehle).
Diese Überschriften bei Erweiterungen beibehalten.

## Feature-Ordner

**Ist-Stand:** `src/app/features/<domain>/` bündelt Fachgebiete wie `members`,
`attendance` und `announcements`. Darin liegen Seiten-/Dialog-Unterordner, lokale
Services, Modelle und `<domain>.routes.ts`. `src/app/core/` enthält gemeinsame
Services, Modelle, Guards, Navigation, i18n und UI. `src/app/shell/` enthält den
Anwendungsrahmen. `docs/architecture/adr/` und `patterns/` enthalten bislang nur
Platzhalter; sie definieren noch keine zusätzlichen Muster.

**Regeln:** Dateien nach Fachgebiet und Verantwortung ablegen, Tests daneben als
`*.spec.ts`. Die vorhandenen Suffixe `.component.ts`, `.service.ts`, `.model.ts`
und `.routes.ts` fortführen. Keine Imports zwischen Features; gemeinsam genutzte
Logik, Modelle und Bausteine gehören nach `core/`. Es gibt noch einzelne direkte
Feature-Imports, etwa Datumshelfer im Announcement-Dialog aus dem RSVP-Dialog;
diese sind keine Vorlage für neue Abhängigkeiten. Neue Boundary-Regeln oder
umfassende Bereinigungen brauchen ein eigenes Ticket.

## Komponenten

**Ist-Stand:** Standalone-Komponenten verwenden `inject()`, Signals und
`input()`/`output()` bzw. `model()`; umfangreiche Templates liegen in eigenen
HTML-Dateien. Die Anwendung ist über `app.config.ts` mit Zone.js und
`provideZoneChangeDetection()` konfiguriert.

**Regeln:** Kleine, fachlich klar benannte Komponenten bauen. Templates zeigen
Zustand und leiten Aktionen weiter; HTTP und wiederverwendbare Fachlogik gehören
in Services. Abgeleitete Werte mit `computed()` statt doppelter Zustandsführung
modellieren. Bestehende Change-Detection- und Bootstrap-Konfiguration beibehalten;
dieses Dokument führt weder eine zoneless-Migration noch eine pauschale
OnPush-Umstellung ein. Selektoren folgen der ESLint-Konfiguration: Komponenten
`app-…`, Direktiven `app…`.

## Services

**Ist-Stand:** Fachservices verwenden den gemeinsamen
[`ApiService`](../../src/app/core/services/api.service.ts). Beispielsweise hält
`AnnouncementsService` CRUD-Aufrufe, während `MemberService` zusätzlich Listenstate
verwaltet. Gemeinsame API-Adapter wie `GuideHomeApi` liegen in `core/services/`.

**Regeln:** Backend-Aufrufe ausschließlich über `ApiService`; kein `HttpClient`
in Komponenten und keine eigene HTTP-Schicht pro Feature. Fachmethoden mit
konkreten Request-/Response-Typen anbieten; den
[API-Leitfaden](api.md#api-vertrag) vor jedem neuen Aufruf prüfen. Komponenten
behandeln fachliche Lade-/Fehlerzustände, der Interceptor die Authentifizierung.
Services ohne globalen Zustand können wie vorhanden `providedIn: 'root'` nutzen;
lebenszyklusgebundenen Seitenstate am zugehörigen Komponenten-Provider bereitstellen.

## Routing

**Ist-Stand:** [`app.routes.ts`](../../src/app/app.routes.ts) lädt Features über
`loadChildren` und Seiten über `loadComponent` nach. Die Shell verwendet
`authGuard` und `webAccessGuard`. Fachrouten nutzen `featureGuard`, etwa
[`members.routes.ts`](../../src/app/features/members/members.routes.ts).
`register/:token` ist bewusst öffentlich und liegt außerhalb der Shell.

**Regeln:** Neue Datenrouten lazy laden und mit `featureGuard('<FeatureId>')`
schützen; Schreibseiten verwenden den Modus `'write'`. Zugriff und Navigation
beziehen ihre Rollen aus
[`FEATURE_ACCESS`](../../src/app/core/navigation/feature-access.ts), ohne eine
zweite Rollenmatrix in Komponenten. Guards dienen der UI-Steuerung; der Server
muss jede Operation autorisieren. In Mitglieds-URLs steht die `publicId` (UUID),
nie die interne Datenbank-ID. Statische Segmente wie `new` vor `:publicId`
definieren. Bei ungespeicherten Änderungen `unsavedChangesGuard` wie im
Member-Editor einbinden. Öffentliche Routen nur für ausdrücklich vorgesehene
Nutzerflüsse anlegen, nicht als Umgehung einer fehlenden Berechtigung.

## State

**Ist-Stand:** Signals halten synchronen UI-Zustand; RxJS steuert asynchrone
Aufrufe. `MemberService` hält Listenfilter und Ergebnisse. Der komponentenlokale
[`GuideHomeState`](../../src/app/features/home/guide-home-state.service.ts)
koordiniert Refresh, Ladezustand und Lifecycle. Ein zusätzlicher Store wie NgRx
ist nicht installiert.

**Regeln:** Zustand beim kleinsten gemeinsamen Besitzer halten. Veränderbaren
Zustand mit `signal()`, Ableitungen mit `computed()` darstellen. Effekte für
Seiteneffekte verwenden, nicht zum Spiegeln berechenbarer Werte. Laden, leerer
Erfolg, Fehler und Speichern unterscheidbar halten; Fehler nicht als leere Liste
tarnen. Bei Such-/Filteranfragen veraltete Ergebnisse durch passende
RxJS-Verkettung (z. B. `switchMap`) ausschließen. Langlebige Subscriptions mit
`async`-Pipe oder `takeUntilDestroyed()` beenden; außerhalb eines Injection-Kontexts
den injizierten `DestroyRef` übergeben. Eventlistener und Timer beim Zerstören
aufräumen. Cache-/Provider-Lebensdauer bewusst wählen, damit Benutzer- oder
Routenwechsel keine alten Daten anzeigen. Keine neue State-Bibliothek ohne
freigegebene technische Entscheidung einführen.

## Formulare

**Ist-Stand:** Komplexe Editoren nutzen Reactive Forms, etwa
[`MemberEditComponent`](../../src/app/features/members/member-edit/member-edit.component.ts)
und der Announcement-Dialog mit `FormBuilder`, Feld- und Gruppenvalidatoren.

**Regeln:** Fachformulare mit typisierten Reactive Forms und expliziter
Nullbehandlung bauen. Pflichtfelder, Längen und fachliche Abhängigkeiten am
Formularmodell validieren; bei ungültigem Submit `markAllAsTouched()` verwenden.
Fehlermeldungen am zugehörigen, berührten Feld anzeigen, Controls mit Labels
verbinden und Tastaturbedienung erhalten. Während des Speicherns doppelte
Übermittlungen verhindern; bei Fehlern Eingaben behalten. DTOs explizit aus dem
Formular abbilden, einschließlich Datum-/Zeitzonen- und `null`-Semantik des
Vertrags. Serverseitige Validierung bleibt erforderlich. Neue Übersetzungsschlüssel
immer in `public/i18n/ko.json` und `public/i18n/en.json` ergänzen. Vorhandene einfache
Filtercontrols nicht allein für diese Richtlinie auf ein anderes Formularsystem
umstellen.

## Design-System

**Ist-Stand:** Das UI nutzt PrimeNG 21 und Bausteine in
[`core/ui/`](../../src/app/core/ui/), etwa DataTable, PageHeader und EmptyState.
[`styles.scss`](../../src/styles.scss) enthält primitive und semantische Tokens
sowie Dichtewerte; [`tailwind.config.js`](../../tailwind.config.js) bildet sie auf
Utilities ab. [`DnPreset`](../../src/app/core/ui/dn-theme.preset.ts) passt Aura
an diese Tokens an. `app.config.ts` koppelt PrimeNG-Dark-Mode an
`[data-theme="dark"]`.

**Regeln:** Freigegebene Figma-Frames in Light/Dark sind die Designreferenz.
Zuerst vorhandene `core/ui`-Bausteine, dann PrimeNG verwenden. Farben, Abstände,
Typografie und Schatten aus semantischen Tokens beziehen; keine freien Hex-Werte
oder primitiven Farbwerte in Features. PrimeNG über das zentrale Preset und
Design-Tokens anpassen; keine neuen `::ng-deep`-Overrides pro Feature.
Responsive Verhalten, Fokus, Kontrast, Lade-/Leer-/Fehlerzustände und lange
Übersetzungen mitprüfen. Layoutfehler am tatsächlich gerenderten Screen messen;
grüne Unit-Tests belegen keine korrekte Geometrie.

## Tests

**Ist-Stand:** `angular.json` verwendet Karma/Jasmine mit ChromeHeadless.
Komponenten-, Guard- und Servicetests liegen neben dem Code.
[`member.service.spec.ts`](../../src/app/features/members/member.service.spec.ts)
prüft Requests und Listenstate mit `HttpTestingController`;
[`jwt.interceptor.spec.ts`](../../src/app/core/interceptors/jwt.interceptor.spec.ts)
prüft Token-Grenzen und Fehlerfälle. Node-Tests für Skripte laufen separat.
Auf diesem Stand sind weder Playwright noch Architekturtests eingerichtet;
ESLint prüft noch keine Feature-Abhängigkeiten.

**Regeln:** Neue Logik mit Verhaltenstests abdecken, Bugfixes mit einem
Regressionstest. Bei HTTP-Tests `provideHttpClient()` vor
`provideHttpClientTesting()` registrieren; Methode, URL, Query/Body und
Fehlerantworten prüfen und offene Requests mit `verify()` ausschließen.
Komponententests prüfen sichtbare Zustände, Validierung und Aktionen; Guardtests
erlaubte und verweigerte Rollen. Neue/geänderte Web-Nutzerflüsse erhalten gemäß
Team-DoD Playwright-E2E-Tests ihrer Akzeptanzkriterien. Solange dessen Einrichtung
noch fehlt, diese Abhängigkeit im Ticket benennen; Unit-Tests ersetzen die
E2E-Abdeckung nicht. Reine Dokumentationsänderungen benötigen keine neuen
Anwendungstests; Links, Aussagen zum Ist-Stand und Abschnittsanker prüfen.

## Pruefbefehle

Aus `.team/config.yml` und der bestehenden CI, nach `npm ci`:

```bash
npx ng lint
npx ng test --watch=false --browsers=ChromeHeadless
npm run test:scripts
npx ng build
```

Für ChromeHeadless muss Chrome verfügbar sein, gegebenenfalls mit `CHROME_BIN`.
Für Architekturtests und E2E ist in der aktuellen Team-Config noch kein Befehl
hinterlegt. Ausgeführte Checks und verbleibende Einschränkungen im PR nennen.

## Quellen

Die Projektkonventionen oben konkretisieren den
[Angular Style Guide](https://angular.dev/style-guide), die Dokumentation zu
[Reactive Forms](https://angular.dev/guide/forms/reactive-forms) und
[HTTP-Tests](https://angular.dev/guide/http/testing) sowie das
[PrimeNG-21-Theming](https://v21.primeng.org/theming). Aktuelle Dokumentationsbeispiele
können neuere Versionen zeigen; maßgeblich für Imports und APIs bleibt der
installierte Stand aus `package-lock.json`.
