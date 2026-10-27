# API-Richtlinien

## API-Vertrag

Verbindlicher Vertrag ist `hanmaum-dn-ops/api/openapi.yaml` im benachbarten
Ops-Repository. Vor jedem neuen oder geänderten Aufruf dort HTTP-Methode, Pfad,
Parameter, Request-/Response-Schema, Statuscodes und Berechtigungsanforderungen
prüfen. Nur dort dokumentierte Endpunkte und Parameter verwenden; nicht aus
UI-Anforderungen oder einer vermuteten Server-Fähigkeit ableiten.

Fehlt ein Endpunkt oder weicht die Server-Implementierung ab, ist der Vertrag
veraltet bzw. unvollständig. Die Lücke im Issue dokumentieren und ein Server-Issue
anlegen oder verlinken. Der Server aktualisiert den Vertrag mit
`./gradlew syncOpenApiToOps` (Postgres und Keycloak über Docker erforderlich);
die aktualisierte Spec wird im Ops-Repository committed. Die Web-App editiert
die Spec nicht und baut fehlende Server-Funktionalität nicht clientseitig nach.
Erst nach geklärtem und aktualisiertem Vertrag anbinden.

## Aufrufe

Fachservices verwenden ausschließlich
[`ApiService`](../../src/app/core/services/api.service.ts), Komponenten den
jeweiligen Fachservice. `environment.apiBaseUrl` ist lokal `/api`; der Service
übergibt dazu beispielsweise `/v1/members`, sodass `/api/v1/members` entsteht.
Keine fest eingebauten Server-Hosts oder eigenen Authorization-Header verwenden.
Der [`jwtInterceptor`](../../src/app/core/interceptors/jwt.interceptor.ts) setzt
Tokens nur für die eigene API; ausdrücklich öffentliche Formularrouten sind
ausgenommen. `401` stößt den Login an, `403` bleibt beim Aufrufer zur Behandlung.
Der Server prüft die Berechtigung unabhängig von den UI-Guards.

## Daten und Fehler

Request-/Response-Typen müssen dem Vertrag entsprechen. `ApiService` entpackt
`ApiResponse<T>` und meldet `success: false` oder `data: null` als Fehler.
Bei DELETE gemäß Vertrag zwischen `delete()` (ohne benötigten Body),
`deleteData<T>()` (Envelope) und `deleteOptional<T>()` (204 oder Envelope)
wählen. Paging verwendet die vorhandene `PageResponse<T>`-Form und nullbasierte
Seitennummern, soweit der konkrete Endpunkt dies vorsieht. IDs, Enums,
Datum-/Zeitzonenwerte, optionale Felder und wiederholte Query-Parameter exakt
nach Vertrag abbilden; in Mitglieds-URLs ausschließlich `publicId` verwenden.

HTTP-Fehler und fachliche Fehler sichtbar behandeln, ohne Tokens oder
personenbezogene Nutzdaten zu loggen. Tests prüfen insbesondere URL, Methode,
Parameter/Body und Fehlerfälle; siehe [Angular-Tests](angular.md#tests).
Mocks belegen das Clientverhalten, nicht die Aktualität des Serververtrags.
