# Rollen und Zugriff

Figma: 08 · Roles, Rollenmatrix (254:3). Im Code lebt die Matrix in
`src/app/core/navigation/feature-access.ts`; Sidebar, Route-Guards
(`featureGuard`) und Header lesen nur diese Tabelle.

| Bildschirm | admin | pastor | group_leader / leader | newcomer_viewer / newcomer_editor | member |
|---|---|---|---|---|---|
| 홈 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 청년 (members) | ✓ | ✓ | – | – | – |
| 새가족 (newcomers) | ✓ | ✓ | – | ✓ | – |
| 순 (church-groups) | ✓ | ✓ | ✓ | – | – |
| 출석, 이벤트, 사역, 공지사항, 기록 | ✓ | ✓ | – | – | – |
| 통계 (analytics) | ✓ | ✓ | – | – | – |

- Rollen werden ohne Rücksicht auf Groß- und Kleinschreibung verglichen.
- Was die Matrix nicht erlaubt, fehlt in der Navigation. Eine direkte URL
  führt auf `/forbidden` (Figma 745:41755).
- Bildschirme, deren Schreib-Endpunkte der Server nur `ADMIN` erlaubt, bleiben
  hier admin-only. Wer sie öffnet, soll keine Buttons sehen, die mit 403 antworten.

## Keycloak-Voraussetzungen

1. **`pastor` fehlt im Realm.** Bis die Realm-Rolle angelegt ist, hat nur
   `admin` Vollzugriff.
2. **순장 ist `group_leader`.** Die Matrix nennt die Rolle `leader`; beide
   Namen werden akzeptiert.
3. **새가족-Rollen** heißen im Realm `NEWCOMER_VIEWER` und `NEWCOMER_EDITOR`.
   Ein Konto nur mit diesen Rollen sieht 홈 und 새가족.
4. **`member`** (청년) sieht nur 홈.
