#!/usr/bin/env bash
# End-to-end nurse check: sign in -> list alerts -> acknowledge twice. Never prints tokens or keys.
# Run from the repo root:  bash apps/api/scripts/smoke-nurse.sh
set -u
cd "$(dirname "$0")/../../.."
set -a; source apps/api/.env; set +a
API="${API:-http://localhost:3000}"

EM="${NURSE_EMAIL:-}"; PW="${NURSE_PASSWORD:-}"
[ -z "$EM" ] && read -r -p "Nurse email: " EM
[ -z "$PW" ] && read -r -s -p "Nurse password (hidden): " PW && echo

RESP=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H 'content-type: application/json' \
  -d "$(python3 -c 'import json,sys;print(json.dumps({"email":sys.argv[1],"password":sys.argv[2]}))' "$EM" "$PW")")
TOKEN=$(printf '%s' "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "SIGN-IN FAILED: $(printf '%s' "$RESP" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("error_code") or d.get("msg") or d)' 2>/dev/null)"
  echo "Check the email/password, and that the user has 'Auto Confirm' on (Supabase > Authentication > Users)."
  exit 1
fi
echo "sign-in OK (token length ${#TOKEN})"
A="authorization: Bearer $TOKEN"

echo "--- open alerts"
curl -s "$API/api/alerts?status=open" -H "$A" | python3 -c 'import sys,json;[print(a["id"],a["type"],a["status"],a["source"]) for a in json.load(sys.stdin)]'
ID=$(curl -s "$API/api/alerts?status=open" -H "$A" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"] if d else "")')
if [ -z "$ID" ]; then echo "No open alert to acknowledge (send an SOS first)."; exit 0; fi

for n in 1 2; do
  echo "--- acknowledge #$n"
  curl -s -w '\nHTTP %{http_code}\n' -X PATCH "$API/api/alerts/$ID/acknowledge" -H "$A" -H 'content-type: application/json' -d '{}' \
    | python3 -c 'import sys;t=sys.stdin.read();import json;b,_,c=t.rpartition("\nHTTP ");d=json.loads(b);print("HTTP",c.strip(),d["status"],"at",d["acknowledgedAt"],"by",d["acknowledgedBy"])'
done
echo "--- patients"
curl -s "$API/api/patients" -H "$A" | python3 -c 'import sys,json;[print(p["room"],p["displayName"],"online="+str(p["device"]["isOnline"] if p["device"] else None),"openAlerts="+str(p["activeAlertCount"])) for p in json.load(sys.stdin)]'
