#!/usr/bin/env bash
# One-time platform setup: makes an existing client the master (SaaS admin) and creates
# what onboarding from the admin page needs.
#
#   infra/setup-master.sh <master client> <admin email>
#
#   1. Adds the Platform.Admin app role to the master client's API app and gives it to
#      the admin. Only tokens with this role can use the admin API.
#   2. Creates the Clients registry table and lets the admin (you) write it and the
#      GitHub deploy identity read it. Migrates any clients/*.json files into it.
#   3. Creates the provisioner identity, "anaviche-provisioner": usable only by GitHub
#      workflows in this repo's "provisioning" environment, with the Graph and Azure
#      rights that creating a client stack needs. Saves its id in infra/platform.env.
#   4. Re-runs new-client.sh for the master with MASTER=true, which turns on the admin.
#
# Run signed in to Azure CLI as a Global Administrator (for the Graph permission grants)
# with Owner on the subscription. Safe to re-run.
set -euo pipefail

client="${1:?usage: setup-master.sh <master client> <admin email>}"
admin_email="${2:?usage: setup-master.sh <master client> <admin email>}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=platform.env
source "$repo_root/infra/platform.env"
graph="https://graph.microsoft.com/v1.0"
graph_app_id="00000003-0000-0000-c000-000000000000"
repo="neerkum1980/anaviche_functions"
sub_scope="/subscriptions/$SUBSCRIPTION_ID"
registry_scope="$(az storage account show -n "$REGISTRY_ACCOUNT" -g "$REGISTRY_RG" --query id -o tsv)"

log() { printf '\n== %s\n' "$*"; }
role() {  # role <principal object id> <principal type> <role> <scope>
  az role assignment create --assignee-object-id "$1" --assignee-principal-type "$2" --role "$3" --scope "$4" -o none
}
user_id_for() {
  az rest --method GET --uri "$graph/users?\$filter=userPrincipalName eq '$1' or mail eq '$1' or otherMails/any(m:m eq '$1')&\$count=true" \
    --headers ConsistencyLevel=eventual --query "value[0].id" -o tsv
}

# ---------------------------------------------------------------------------
log "1. Platform.Admin role on anaviche-$client-api"
# ---------------------------------------------------------------------------
api_app_id="$(az ad app list --display-name "anaviche-$client-api" --query "[0].appId" -o tsv)"
[ -n "$api_app_id" ] || { echo "No anaviche-$client-api app; run new-client.sh for $client first." >&2; exit 1; }
api_obj="$(az ad app show --id "$api_app_id" --query id -o tsv)"
admin_role_id="$(az ad app show --id "$api_app_id" --query "appRoles[?value=='Platform.Admin'].id | [0]" -o tsv)"
if [ -z "$admin_role_id" ]; then
  admin_role_id="$(python3 -c 'import uuid; print(uuid.uuid4())')"
  az rest --method PATCH --uri "$graph/applications/$api_obj" --headers Content-Type=application/json --body "{
    \"appRoles\": [{
      \"id\": \"$admin_role_id\", \"value\": \"Platform.Admin\", \"isEnabled\": true,
      \"allowedMemberTypes\": [\"User\"],
      \"displayName\": \"Platform admin\",
      \"description\": \"Can see all clients and onboard new ones in the Anaviche admin.\"
    }]
  }"
fi
api_sp="$(az ad sp show --id "$api_app_id" --query id -o tsv)"
admin_id="$(user_id_for "$admin_email")"
[ -n "$admin_id" ] || { echo "No user $admin_email in the directory." >&2; exit 1; }
has_role="$(az rest --method GET --uri "$graph/servicePrincipals/$api_sp/appRoleAssignedTo" \
  --query "value[?principalId=='$admin_id' && appRoleId=='$admin_role_id'] | length(@)" -o tsv)"
if [ "$has_role" = "0" ]; then
  az rest --method POST --uri "$graph/servicePrincipals/$api_sp/appRoleAssignedTo" --headers Content-Type=application/json \
    --body "{\"principalId\": \"$admin_id\", \"resourceId\": \"$api_sp\", \"appRoleId\": \"$admin_role_id\"}" -o none
fi
echo "$admin_email is a platform admin"

# ---------------------------------------------------------------------------
log "2. Client registry ($REGISTRY_ACCOUNT/$REGISTRY_TABLE)"
# ---------------------------------------------------------------------------
role "$admin_id" User "Storage Table Data Contributor" "$registry_scope"
deploy_sp="$(az ad sp show --id "$DEPLOY_APP_ID" --query id -o tsv)"
role "$deploy_sp" ServicePrincipal "Storage Table Data Reader" "$registry_scope"
# The release and provisioning workflows look up clients outside any GitHub environment,
# so the deploy identity also trusts plain runs on main (it can only read the registry
# and deploy code, never create resources).
if [ -z "$(az ad app federated-credential list --id "$DEPLOY_APP_ID" --query "[?name=='github-main'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$DEPLOY_APP_ID" --parameters "{
    \"name\": \"github-main\", \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$repo:ref:refs/heads/main\", \"audiences\": [\"api://AzureADTokenExchange\"]}" -o none
fi
# Role assignments take a minute to apply to data access.
for _ in $(seq 1 12); do
  az storage table create --name "$REGISTRY_TABLE" --account-name "$REGISTRY_ACCOUNT" --auth-mode login -o none 2>/dev/null && break
  sleep 10
done
for f in "$repo_root"/clients/*.json; do
  [ -f "$f" ] || continue
  c="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["client"])' "$f")"
  args=()
  while IFS= read -r kv; do args+=("$kv"); done < <(python3 -c '
import json, sys
for k, v in json.load(open(sys.argv[1])).items():
    if k != "client":
        print(f"{k}={v}")' "$f")
  az storage entity insert --if-exists merge -o none --account-name "$REGISTRY_ACCOUNT" --table-name "$REGISTRY_TABLE" \
    --auth-mode login --entity PartitionKey=client RowKey="$c" status=ready "${args[@]}"
  echo "migrated $f"
done

# ---------------------------------------------------------------------------
log "3. Provisioner identity"
# ---------------------------------------------------------------------------
prov_app_id="$(az ad app list --display-name anaviche-provisioner --query "[0].appId" -o tsv)"
if [ -z "$prov_app_id" ]; then
  prov_app_id="$(az ad app create --display-name anaviche-provisioner --sign-in-audience AzureADMyOrg --query appId -o tsv)"
fi
prov_sp="$(az ad sp show --id "$prov_app_id" --query id -o tsv 2>/dev/null || az ad sp create --id "$prov_app_id" --query id -o tsv)"
if [ -z "$(az ad app federated-credential list --id "$prov_app_id" --query "[?name=='github-provisioning'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$prov_app_id" --parameters "{
    \"name\": \"github-provisioning\", \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$repo:environment:provisioning\", \"audiences\": [\"api://AzureADTokenExchange\"]}" -o none
fi

# Graph application permissions. OwnedBy limits app changes to the apps it creates.
graph_sp="$(az ad sp show --id "$graph_app_id" --query id -o tsv)"
for perm in Application.Read.All Application.ReadWrite.OwnedBy Group.ReadWrite.All User.Read.All \
            User.Invite.All AppRoleAssignment.ReadWrite.All DelegatedPermissionGrant.ReadWrite.All; do
  perm_id="$(az ad sp show --id "$graph_app_id" --query "appRoles[?value=='$perm'].id | [0]" -o tsv)"
  granted="$(az rest --method GET --uri "$graph/servicePrincipals/$prov_sp/appRoleAssignments" \
    --query "value[?appRoleId=='$perm_id'] | length(@)" -o tsv)"
  if [ "$granted" = "0" ]; then
    az rest --method POST --uri "$graph/servicePrincipals/$prov_sp/appRoleAssignments" --headers Content-Type=application/json \
      --body "{\"principalId\": \"$prov_sp\", \"resourceId\": \"$graph_sp\", \"appRoleId\": \"$perm_id\"}" -o none
  fi
  echo "Graph: $perm"
done

# Azure: create resource groups and stacks, and give the deploy identity release access.
role "$prov_sp" ServicePrincipal "Contributor" "$sub_scope"
role "$prov_sp" ServicePrincipal "Role Based Access Control Administrator" "$sub_scope"
role "$prov_sp" ServicePrincipal "Storage Table Data Contributor" "$registry_scope"
echo "Azure: Contributor and Role Based Access Control Administrator on the subscription"

sed -i.bak "s/^PROVISIONER_APP_ID=.*/PROVISIONER_APP_ID=$prov_app_id/" "$repo_root/infra/platform.env"
rm -f "$repo_root/infra/platform.env.bak"
echo "provisioner: anaviche-provisioner ($prov_app_id), saved in infra/platform.env"

# ---------------------------------------------------------------------------
log "4. Turn on the admin in $client's stack"
# ---------------------------------------------------------------------------
client_name="$(az storage entity show --account-name "$REGISTRY_ACCOUNT" --table-name "$REGISTRY_TABLE" --auth-mode login \
  --partition-key client --row-key "$client" --query clientName -o tsv)"
MASTER=true "$repo_root/infra/new-client.sh" "$client" "$client_name"

log "Done. Sign out and in again on the master site to get the Platform.Admin role."
