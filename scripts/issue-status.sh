#!/usr/bin/env bash
# Setzt den Status eines Issues im GitHub Project.
#
#   scripts/issue-status.sh 42 "In Progress"
#   scripts/issue-status.sh --list          # Board-Stand ausgeben
#
# gh project item-edit kann Felder NICHT per Namen setzen (Stand gh 2.88) —
# es braucht --id / --field-id / --single-select-option-id. Dieses Skript loest
# alle IDs auf und legt das Issue bei Bedarf im Project an.
set -euo pipefail

PROJECT_NUMBER="${PROJECT_NUMBER:-7}"
PROJECT_OWNER="${PROJECT_OWNER:-@me}"

if [[ "${1:-}" == "--list" ]]; then
  # gh project item-list liefert in gh 2.88 fuer User-Projects nichts zurueck,
  # daher direkt ueber GraphQL.
  gh api graphql -f owner="$(gh api user -q .login)" -F number="$PROJECT_NUMBER" -f query='
    query($owner: String!, $number: Int!) {
      user(login: $owner) { projectV2(number: $number) {
        items(first: 100) { nodes {
          content { ... on Issue { number title state } }
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }' |
  python3 -c '
import json, sys
for n in json.load(sys.stdin)["data"]["user"]["projectV2"]["items"]["nodes"]:
    c = n.get("content") or {}
    if not c: continue
    st = (n.get("fieldValueByName") or {}).get("name", "-")
    print("#%-5s %-12s %s" % (c["number"], st, c["title"]))
'
  exit 0
fi

ISSUE="${1:?Usage: issue-status.sh <issue-number> <Todo|In Progress|Done> | --list}"
STATUS="${2:?Usage: issue-status.sh <issue-number> <Todo|In Progress|Done> | --list}"

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
URL="https://github.com/${REPO}/issues/${ISSUE}"

PROJECT_ID="$(gh project view "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json -q .id)"

# Item anlegen (idempotent — gh gibt bei vorhandenem Item dessen ID zurueck)
ITEM_ID="$(gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --url "$URL" --format json -q .id)"

read -r FIELD_ID OPTION_ID < <(
  gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json |
  STATUS="$STATUS" python3 -c '
import json, os, sys
status = os.environ["STATUS"]
for f in json.load(sys.stdin)["fields"]:
    if f["name"] != "Status":
        continue
    for o in f.get("options", []):
        if o["name"].lower() == status.lower():
            print(f["id"], o["id"])
            sys.exit(0)
    sys.exit(f"Status-Option {status!r} nicht gefunden: "
             + ", ".join(o["name"] for o in f.get("options", [])))
sys.exit("Kein Status-Feld im Project")
'
)

gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$FIELD_ID" \
  --single-select-option-id "$OPTION_ID" >/dev/null

echo "#${ISSUE} -> ${STATUS}"
