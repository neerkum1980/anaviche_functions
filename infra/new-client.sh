#!/usr/bin/env bash
# Creates (or updates) one client's complete Anaviche stack.
#
#   infra/new-client.sh <client> "<Client Name>" [location]
#
#   client    short id, 3-12 lowercase letters/digits, e.g. neerajkumar
#   location  Azure region for the backend (default francecentral)
#
# Steps, all safe to re-run:
#   1. Entra ID: a users group, an API app and a web (SPA) app for the client. Both
#      apps require assignment, so only users added with add-user.sh can sign in.
#   2. Resource group + infra/client.bicep (Function App, storage, monitoring, frontend).
#   3. Points the web app's redirect URI at the client's frontend.
#   4. Lets the GitHub deploy identity release code to this client only.
#   5. Records the client in the Clients registry table (status ready), which the
#      Release workflow and the admin API read.
#
# Normally run by the "Provision clients" workflow for requests made in the admin
# page. To run it by hand, sign in to Azure CLI as a user who can create app
# registrations, assign roles and write the registry table. MASTER=true marks the
# master client, whose stack also runs the platform admin.
set -euo pipefail

client="${1:?usage: new-client.sh <client> \"<Client Name>\" [location]}"
client_name="${2:?usage: new-client.sh <client> \"<Client Name>\" [location]}"
location="${3:-francecentral}"
[[ "$client" =~ ^[a-z0-9]{3,12}$ ]] || { echo "client must be 3-12 lowercase letters or digits" >&2; exit 1; }

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=platform.env
source "$repo_root/infra/platform.env"
rg="rg-anaviche-$client"
tenant_id="$TENANT_ID"
graph="https://graph.microsoft.com/v1.0"
deploy_app_id="$DEPLOY_APP_ID"   # anaviche-functions-github-deploy
graph_app_id="00000003-0000-0000-c000-000000000000"     # Microsoft Graph
graph_user_read="e1fe6dd8-ba31-4d61-89e7-88639da4683d"  # Graph delegated User.Read

log() { printf '\n== %s\n' "$*"; }

registry() {  # registry <az storage entity subcommand> [args...]
  az storage entity "$@" --account-name "$REGISTRY_ACCOUNT" --table-name "$REGISTRY_TABLE" --auth-mode login
}

# The master flag is kept in the registry, so a re-run never drops the admin.
if [ -z "${MASTER:-}" ]; then
  MASTER="$(registry show --partition-key client --row-key "$client" --query master -o tsv 2>/dev/null || true)"
fi
[ "$(printf %s "$MASTER" | tr "[:upper:]" "[:lower:]")" = "true" ] && is_master=true || is_master=false

app_id_by_name() { az ad app list --display-name "$1" --query "[0].appId" -o tsv; }
ensure_sp() {
  az ad sp show --id "$1" --query id -o tsv 2>/dev/null || az ad sp create --id "$1" --query id -o tsv
}

# ---------------------------------------------------------------------------
log "1. Entra ID for $client_name"
# ---------------------------------------------------------------------------
group_name="anaviche-$client-users"
group_id="$(az ad group list --display-name "$group_name" --query "[0].id" -o tsv)"
if [ -z "$group_id" ]; then
  group_id="$(az ad group create --display-name "$group_name" --mail-nickname "$group_name" \
    --description "Login users of Anaviche client $client_name" --query id -o tsv)"
fi
echo "users group: $group_name ($group_id)"

api_name="anaviche-$client-api"
api_app_id="$(app_id_by_name "$api_name")"
if [ -z "$api_app_id" ]; then
  api_app_id="$(az ad app create --display-name "$api_name" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
fi
api_obj="$(az ad app show --id "$api_app_id" --query id -o tsv)"
scope_id="$(az ad app show --id "$api_app_id" --query "api.oauth2PermissionScopes[?value=='access_as_user'].id | [0]" -o tsv)"
if [ -z "$scope_id" ]; then
  scope_id="$(python3 -c 'import uuid; print(uuid.uuid4())')"
  az rest --method PATCH --uri "$graph/applications/$api_obj" --headers Content-Type=application/json --body "{
    \"identifierUris\": [\"api://$api_app_id\"],
    \"api\": {
      \"requestedAccessTokenVersion\": 2,
      \"oauth2PermissionScopes\": [{
        \"id\": \"$scope_id\", \"value\": \"access_as_user\", \"type\": \"User\", \"isEnabled\": true,
        \"adminConsentDisplayName\": \"Use Anaviche as the signed-in user\",
        \"adminConsentDescription\": \"Lets the Anaviche web app call the $client_name API as the signed-in user.\",
        \"userConsentDisplayName\": \"Use Anaviche as you\",
        \"userConsentDescription\": \"Lets the Anaviche web app call the $client_name API as you.\"
      }]
    }
  }"
fi
api_sp="$(ensure_sp "$api_app_id")"
az ad sp update --id "$api_app_id" --set appRoleAssignmentRequired=true
echo "API app: $api_name ($api_app_id)"

web_name="anaviche-$client-web"
web_app_id="$(app_id_by_name "$web_name")"
if [ -z "$web_app_id" ]; then
  web_app_id="$(az ad app create --display-name "$web_name" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
fi
web_obj="$(az ad app show --id "$web_app_id" --query id -o tsv)"
az rest --method PATCH --uri "$graph/applications/$web_obj" --headers Content-Type=application/json --body "{
  \"requiredResourceAccess\": [
    {\"resourceAppId\": \"$api_app_id\", \"resourceAccess\": [{\"id\": \"$scope_id\", \"type\": \"Scope\"}]},
    {\"resourceAppId\": \"$graph_app_id\", \"resourceAccess\": [{\"id\": \"$graph_user_read\", \"type\": \"Scope\"}]}
  ]
}"
web_sp="$(ensure_sp "$web_app_id")"
az ad sp update --id "$web_app_id" --set appRoleAssignmentRequired=true
echo "web app: $web_name ($web_app_id)"

# Admin consent, so users are never asked to approve the app themselves.
grant() {  # grant <resource sp object id> <scopes>
  local existing
  existing="$(az rest --method GET --uri "$graph/oauth2PermissionGrants?\$filter=clientId eq '$web_sp' and resourceId eq '$1'" --query "value[0].id" -o tsv)"
  if [ -n "$existing" ]; then
    az rest --method PATCH --uri "$graph/oauth2PermissionGrants/$existing" --headers Content-Type=application/json --body "{\"scope\": \"$2\"}"
  else
    az rest --method POST --uri "$graph/oauth2PermissionGrants" --headers Content-Type=application/json --body "{
      \"clientId\": \"$web_sp\", \"consentType\": \"AllPrincipals\", \"resourceId\": \"$1\", \"scope\": \"$2\"}" -o none
  fi
}
grant "$api_sp" "access_as_user"
grant "$(az ad sp show --id "$graph_app_id" --query id -o tsv)" "openid profile offline_access User.Read"
echo "admin consent granted"

# ---------------------------------------------------------------------------
log "2. Azure resources in $rg"
# ---------------------------------------------------------------------------
az group create -n "$rg" -l "$location" --tags app=anaviche client="$client" clientName="$client_name" -o none
# A redeploy replaces all app settings; carry over the gateway key if the app already has one.
existing_app="$(az resource list -g "$rg" --resource-type Microsoft.Web/sites --query "[0].name" -o tsv)"
functions_key=""
if [ -n "$existing_app" ]; then
  functions_key="$(az functionapp config appsettings list -n "$existing_app" -g "$rg" --query "[?name=='FUNCTIONS_KEY'].value | [0]" -o tsv)"
fi
outputs="$(az deployment group create -g "$rg" -n "anaviche-$client" \
  --template-file "$repo_root/infra/client.bicep" \
  --parameters client="$client" clientName="$client_name" location="$location" \
               apiAppId="$api_app_id" tenantId="$tenant_id" functionsKey="$functions_key" isMaster="$is_master" \
  --query properties.outputs -o json)"
out() { python3 -c "import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]]['value'])" "$outputs" "$1"; }
function_app="$(out functionAppName)"
function_host="$(out functionAppHost)"
frontend="$(out frontendName)"
frontend_url="$(out frontendUrl)"
echo "Function App: $function_app ($function_host)"
echo "frontend:     $frontend ($frontend_url)"

# ---------------------------------------------------------------------------
log "3. Web app redirect URI"
# ---------------------------------------------------------------------------
az rest --method PATCH --uri "$graph/applications/$web_obj" --headers Content-Type=application/json \
  --body "{\"spa\": {\"redirectUris\": [\"$frontend_url/\", \"http://localhost:4280/\"]}}"
echo "redirect URIs: $frontend_url/, http://localhost:4280/"

# ---------------------------------------------------------------------------
log "4. Release access for the GitHub deploy identity"
# ---------------------------------------------------------------------------
deploy_sp="$(az ad sp show --id "$deploy_app_id" --query id -o tsv)"
assign() {  # assign <role> <scope>
  az role assignment create --assignee-object-id "$deploy_sp" --assignee-principal-type ServicePrincipal \
    --role "$1" --scope "$2" -o none
}
assign "Website Contributor" "$(az functionapp show -n "$function_app" -g "$rg" --query id -o tsv)"
assign "Contributor" "$(az staticwebapp show -n "$frontend" -g "$rg" --query id -o tsv)"
echo "deploy identity can release to $function_app and $frontend"

# ---------------------------------------------------------------------------
log "5. Client registry"
# ---------------------------------------------------------------------------
az storage table create --name "$REGISTRY_TABLE" --account-name "$REGISTRY_ACCOUNT" --auth-mode login -o none
registry insert --if-exists merge -o none --entity PartitionKey=client RowKey="$client" \
  clientName="$client_name" status=ready message="" \
  resourceGroup="$rg" functionApp="$function_app" apiBase="https://$function_host/api/gateway" \
  staticWebApp="$frontend" frontendUrl="$frontend_url" tenantId="$tenant_id" \
  apiAppId="$api_app_id" apiScope="api://$api_app_id/access_as_user" webAppId="$web_app_id" \
  usersGroup="$group_name" master="$is_master" master@odata.type=Edm.Boolean \
  updatedAt="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
registry show --partition-key client --row-key "$client" \
  --query "{client:RowKey, status:status, master:master, frontendUrl:frontendUrl, functionApp:functionApp}" -o json

log "Done. Next: infra/add-user.sh $client <email>, then run the Release workflow for $client."
