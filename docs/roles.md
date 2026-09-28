# Rollen und Zugriff

Figma: 08 · Roles, Bildschirm-Zugriff (883:164). Im Code lebt die Matrix in
`src/app/core/navigation/feature-access.ts`. Sidebar, Route-Guards
(`featureGuard`, `webAccessGuard`), Header und CRUD-Buttons lesen nur diese
Tabelle.

R = lesen, W = lesen und schreiben, – = kein Zugriff.

| Bildschirm | admin / pastor | note_taker | group_leader / leader | newcomer_viewer | newcomer_editor | member |
|---|---|---|---|---|---|---|
| 홈 | W | R | R | R | R | R |
| 청년 (members) | W | R | – | – | – | – |
| 새가족 (newcomers) | W | – | – | R | W | – |
| 순 (church-groups) | W | R | R | – | – | – |
| 공지사항 (announcements) | W | W | – | – | – | – |
| 출석, 이벤트, 사역, 기록, 통계 | W | – | – | – | – | – |

- Rollen werden ohne Rücksicht auf Groß- und Kleinschreibung verglichen.
- `admin` und `pastor` (`SUPER_ROLES`) lesen und schreiben alles.
- Was die Matrix nicht erlaubt, fehlt: in der Navigation und als Button
  (DESIGN.md §9, nie nur deaktiviert). Eine direkte URL führt auf `/forbidden`
  (Figma 745:41755). Schreib-Routen (`new`, `:publicId/edit`) laufen hinter
  `featureGuard('<feature>', 'write')`.

## Wer in die Web-App kommt

Nur wer mindestens einen Bildschirm außer 홈 lesen darf (`hasWebAccess`).
Alle anderen, etwa `member`, schickt `webAccessGuard` auf die 403-Variante
„화면 준비 중“ (Figma 879:210 Light, 879:370 Dark): Sie nennt die eigenen Rollen
und bietet nur Logout an.

## Neues 사역-Team hinzufügen

1. `FeatureId` für den Bildschirm des Teams anlegen.
2. In `FEATURE_ACCESS` eintragen:
   `{ read: ['<slug>_viewer', '<slug>_editor'], write: ['<slug>_editor'] }`.
3. Route mit `featureGuard('<feature>')` schützen, Schreib-Routen mit `'write'`.
4. Realm-Rollen `<slug>_viewer` und `<slug>_editor` in Keycloak anlegen.

Web-Zugang ergibt sich aus der Zeile allein. Bis es den Bildschirm gibt, sehen
Teammitglieder nichts.

## Keycloak-Voraussetzungen

Rollen werden über Gruppen vergeben, nie direkt am User (server#240,
`KEYCLOAK_RUNBOOK.md` im Server):

| Gruppe | Realm-Rollen |
|---|---|
| `/staff/admins` | `admin` |
| `/staff/pastors` | `pastor` |
| `/staff/note-takers` | `note_taker` |
| `/leaders/groups` | `group_leader` |
| `/ministries/newcomer/viewers` | `NEWCOMER_VIEWER` |
| `/ministries/newcomer/editors` | `NEWCOMER_VIEWER`, `NEWCOMER_EDITOR` |
| `/ministries/<slug>/members` | `<SLUG>_VIEWER` |
| `/ministries/<slug>/leaders` | `<SLUG>_VIEWER`, `<SLUG>_EDITOR`, `ministry_leader` |

1. **`pastor` ist serverseitig `admin` gleichgestellt** (RoleHierarchy
   `ROLE_PASTOR > ROLE_ADMIN`). Das Web bildet das über `SUPER_ROLES` ab.
2. **`note_taker`** darf laut Server dasselbe wie in der Matrix oben: 청년 und
   순 lesen, 공지사항 lesen und schreiben.
3. **순장 ist `group_leader`.** Die Matrix nennt die Rolle `leader`; beide
   Namen werden akzeptiert.
4. **새가족-Rollen** heißen im Realm `NEWCOMER_VIEWER` und `NEWCOMER_EDITOR`.
