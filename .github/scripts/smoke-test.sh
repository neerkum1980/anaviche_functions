#!/usr/bin/env bash
# Read-only smoke test of every function on one Function App.
#
#   .github/scripts/smoke-test.sh <function app> <resource group> <gateway status without sign-in>
#
# The last argument is 200 for the test app (no sign-in) and 401 for client stacks,
# where gateway must refuse anyone who is not signed in. Any import error makes a
# function answer 500, so a function returning its own expected status has loaded.
set -euo pipefail
app="$1"; rg="$2"; gateway_status="$3"
# AdminApi: switched off on the test app (404); behind sign-in on client stacks (401).
[ "$gateway_status" = "200" ] && admin_status=404 || admin_status=401

key=$(az functionapp keys list -n "$app" -g "$rg" --query functionKeys.default -o tsv)
echo "::add-mask::$key"
# az functionapp show leaves defaultHostName empty for Flex Consumption apps, and
# az resource show needs subscription-level read that the deploy identity lacks.
host=$(az webapp show -n "$app" -g "$rg" --query defaultHostName -o tsv)
[ -n "$host" ] || { echo "::error::Could not find the host name of $app"; exit 1; }

# function | path | send key? | expected status | text the body must contain
checks="PropertiesAPI|properties|key|200|
ExpenseApi|expenses?propertyId=__smoke__|key|200|
DocumentManagement|DocumentManagement?propertyId=__smoke__|key|200|
BillsDownloadApi|BillsDownloadApi|key|400|documentId
gateway|gateway/properties|nokey|$gateway_status|
AdminApi|admin/clients|nokey|$admin_status|"

run_checks() {
  local failed=0 name path auth want text code headers
  while IFS='|' read -r name path auth want text; do
    headers=()
    [ "$auth" = "key" ] && headers=(-H "x-functions-key: $key")
    code=$(curl -s -o body.txt -w "%{http_code}" --max-time 60 ${headers[@]+"${headers[@]}"} "https://$host/api/$path" || true)
    if [ "$code" = "$want" ] && { [ -z "$text" ] || grep -q "$text" body.txt; }; then
      printf "  ok    %-20s %s\n" "$name" "$code"
    else
      printf "  FAIL  %-20s got %s, want %s\n" "$name" "$code" "$want"; failed=1
    fi
  done <<< "$checks"

  # McpServer speaks JSON-RPC over POST; tools/list must return the tool set.
  code=$(curl -s -o body.txt -w "%{http_code}" --max-time 60 -X POST "https://$host/api/mcp" \
    -H "x-functions-key: $key" -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' || true)
  if [ "$code" = "200" ] && grep -q '"list_properties"' body.txt; then
    printf "  ok    %-20s %s\n" "McpServer" "$code"
  else
    printf "  FAIL  %-20s got %s, want 200 with tools\n" "McpServer" "$code"; failed=1
  fi
  return $failed
}

for i in $(seq 1 10); do
  echo "Attempt $i on $host"
  if run_checks; then echo "All functions passed."; rm -f body.txt; exit 0; fi
  sleep 15
done
echo "::error::Smoke test failed on $host after 10 attempts"; exit 1
