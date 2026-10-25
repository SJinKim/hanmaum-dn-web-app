# Lessons Learned

> Updated after every user correction. Reviewed at session start.

## Format
- **Mistake**: what went wrong
- **Rule**: what to do instead (permanent prevention)

## Lessons
<!-- Claude appends here after each correction -->

### 2026-08-27 — Issues nicht löschen
- **Mistake**: Test-Issue #25 sollte nach dem Smoke-Test per `gh issue delete` entfernt werden.
- **Rule**: Issues nie löschen. Erledigtes wird `gh issue close` + Board-Status `Done` — das Board
  ist die Nachweis-Historie. Gilt auch für Test-/Wegwerf-Issues.

### 2026-08-31 — Kein Code ohne Issue, eigenes Board pro Repo
- **Mistake**: Anforderungen wurden per Zuruf direkt implementiert; das Dashboard-Board
  (Project 5) mischte Server-, Ops- und Web-App-Issues.
- **Rule**: Jede Implementierung braucht vorher ein Issue in `hanmaum-dn-web-app`, das per
  `scripts/issue-status.sh <nr> "Todo"` auf Project 7
  (https://github.com/users/SJinKim/projects/7) liegt. Erst danach Branch und Code.
  Project 5 bleibt das Board der anderen Repos.

### 2026-08-31 — Server-Contract vor Frontend-Debugging prüfen
- **Mistake**: Die 양육-Spalte war "einfach kaputt" — Ursache war eine Katalog-Migration im
  `hanmaum-dn-server`, nicht der Angular-Code.
- **Rule**: Bei falsch gerenderten Backend-Daten zuerst den Contract gegenprüfen:
  `hanmaum-dn-ops/api/openapi.yaml` und die DTOs/Migrationen in `hanmaum-dn-server`
  — beide liegen lokal unter `/Users/seungjinkim/Documents/Private_Projects/` und werden
  direkt gelesen (`cat`, `grep`), nicht über `gh api`.

### 2026-09-22 — Nie aus der API-Oberfläche allein auf "unmöglich" schließen
- **Mistake**: Ich habe erklärt, die Filter 순/양육/사역 in der 청년-Liste seien nicht machbar,
  weil `MemberController.listMembers` diese Parameter nicht kennt. Sie liefen längst — die
  Liste lud mit `size: 1000` alles auf einmal und filterte in AG Grid clientseitig.
  Der User musste mich darauf hinweisen, dass er sie im laufenden UI sieht.
- **Rule**: Bevor eine bestehende Fähigkeit für unmöglich erklärt wird, erst lesen, *wie* die
  aktuelle Implementierung sie erbringt. Der Controller ist die Obergrenze des Servers, nicht
  die Obergrenze des Features. Das Ergebnis ist dann eine Aussage über den Weg
  ("geht heute clientseitig, serverseitig fehlt X"), nicht über die Machbarkeit.

### 2026-09-22 — Die Nachbar-Repos sind lokal lesbar (Korrektur)
- **Mistake**: Die Lesson vom 2026-08-31 behauptete, `hanmaum-dn-ops` und `hanmaum-dn-server`
  seien nur über `gh api` erreichbar. Das ist falsch und hat Umwege über die GitHub-API
  erzeugt, wo ein `cat` gereicht hätte.
- **Rule**: `../hanmaum-dn-ops` und `../hanmaum-dn-server` direkt lesen. In #53 war genau das
  entscheidend: erst die Controller-Quelle (`MemberController.listMembers`) — nicht der
  Spec — hat die tatsächlich unterstützten Query-Parameter gezeigt.

### 2026-09-22 — Kein Layout-Fix ohne Messung am echten Screen
- **Mistake**: Zum Bug "청년-Seite scrollt über den Viewport hinaus und schneidet unten ab"
  habe ich zweimal hintereinander einen Fix gebaut, begründet und gepusht (`50723b7`
  Karten-/Scroller-Kette, `26f4ae9` doppeltes `p-page`), ohne die Seite je gesehen oder
  gemessen zu haben. Beide haben das Symptom nicht behoben; der User musste zweimal melden,
  dass es unverändert ist. Ein dritter Versuch (Host-Klasse auf `app-members-list`) lag schon
  fertig im Baum, als die Messung zeigte, dass er nichts ändert.
- **Rule**: Ein Layout-Bug wird erst gemessen, dann gefixt. `ng lint`/`ng test`/`ng build`
  sind **keine** Evidenz für Layout — sie laufen grün, egal wie die Seite aussieht. Zulässige
  Evidenz: Geometrie aus dem echten Screen (`innerHeight`,
  `documentElement.scrollHeight`, `clientHeight`/`scrollHeight` der Kette) — notfalls per
  Einzeiler, den der User in der DevTools-Konsole ausführt. Wenn kein Blick auf die Seite
  möglich ist (Chrome-Extension nicht verbunden, Login nicht automatisierbar), wird **kein**
  Fix gepusht, sondern die Messung angefordert.
- **Rule**: Ein nachgebauter statischer Harness ist nur dann Evidenz, wenn er den Bug
  reproduziert. Reproduziert er ihn nicht, ist er widerlegt — nicht die Fehlermeldung des
  Users.
- **Detail, das trotzdem stimmt**: Eine geroutete Komponente ist als Host ein Inline-Element
  ohne eigene Höhe. `h-full` *im* Template kann trotzdem greifen (Prozenthöhe rechnet gegen
  den nächsten Block-Container, also `<main>`), `flex-1` aber nicht — dafür muss der Host
  selbst Flex-Container sein (`host: { class: 'flex h-full flex-col' }`, Präzedenz:
  `sidebar.component.ts:42`).

### 2026-09-22 — Figma: gesetzte Layout-Werte sind kein Beweis für das gerenderte Layout
- **Mistake**: Zu #70 habe ich sechs Frames gebaut und als fertig gemeldet. Der User musste
  melden, dass in `Card · 청년 정보` die `성`-Zeile direkt am 기본정보-Tab klebt (F1
  `553:24581`, F3 `555:24807`), während es in 청년 추가 (F2 `554:26580`) richtig aussieht.
  Meine Prüfung vorher war eine Property-Lesung: `itemSpacing: 24`, `layoutPositioning`,
  `layoutSizing*`, `layoutAlign`, Breiten — in F1, F2, F3 **identisch**. Genau deshalb habe
  ich den Fehler nicht gesehen. Abweichend war nur die *aufgelöste* Kindposition:
  `Form grid.y = 31` statt `55`, obwohl der Slot mit `h = 439 = 31 + 24 + 384` den Abstand
  bereits reserviert hatte.
- **Ursache**: Nach strukturellen Eingriffen in einen Auto-Layout-Teilbaum — hier das
  `detachInstance()` der Tabs-Instanz, um einen vierten Tab einzufügen — bleibt die
  aufgelöste Geometrie stehen. Figma schreibt den Wert, rechnet das Layout aber nicht neu.
  `insertChild()` an denselben Index löst **kein** Reflow aus (getestet, y blieb 31).
- **Rule**: Nach `detachInstance()` oder jeder strukturellen Mutation eines
  Auto-Layout-Teilbaums immer die **aufgelösten** `y`/`x`-Offsets der Kinder gegen
  `parent.itemSpacing` gegenrechnen — `child[n].y === child[n-1].y + child[n-1].height +
  itemSpacing`. Stimmt das nicht, ist das Layout stale, egal was die Properties sagen.
- **Rule**: Reflow erzwingt man, indem man `itemSpacing` auf einen anderen Wert und zurück
  setzt (`slot.itemSpacing = 8; slot.itemSpacing = 24;`). Das rechnet neu und lässt
  Slot-/Frame-Höhen unverändert.
- **Rule**: Eine Design-Abgabe ist erst fertig, wenn jeder Frame **gegen seine Referenz**
  geprüft wurde — Screenshot *und* Geometrie-Read, nebeneinander, nicht jeder Frame für sich.
  Der Defekt war auf dem Screenshot sichtbar; mir fehlte der direkte Vergleich F1↔F2.
