#!/usr/bin/env bash
# Gives a person login access to one client.
#
#   infra/add-user.sh <client> <email>
#
# Finds the person in the Entra directory (by sign-in name or email); if they are not
# there, invites them as a guest and Microsoft emails them an invitation. Then adds them
# to the client's users group and assigns them to the client's web and API apps, which
# is what lets them sign in. A user can belong to more than one client.
set -euo pipefail

client="${1:?usage: add-user.sh <client> <email>}"
email="${2:?usage: add-user.sh <client> <email>}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=platform.env
source "$repo_root/infra/platform.env"
config="$(az storage entity show --account-name "$REGISTRY_ACCOUNT" --table-name "$REGISTRY_TABLE" --auth-mode login \
  --partition-key client --row-key "$client" -o json 2>/dev/null || true)"
[ -n "$config" ] || { echo "Client $client is not in the registry; run infra/new-client.sh first." >&2; exit 1; }
cfg() { python3 -c "import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]])" "$config" "$1"; }
graph="https://graph.microsoft.com/v1.0"
default_role="00000000-0000-0000-0000-000000000000"  # "Default Access", for apps without roles

user_id="$(az rest --method GET --uri "$graph/users?\$filter=userPrincipalName eq '$email' or mail eq '$email' or otherMails/any(m:m eq '$email')&\$count=true" \
  --headers ConsistencyLevel=eventual --query "value[0].id" -o tsv)"
if [ -z "$user_id" ]; then
  echo "Inviting $email as a guest"
  user_id="$(az rest --method POST --uri "$graph/invitations" --headers Content-Type=application/json --body "{
    \"invitedUserEmailAddress\": \"$email\",
    \"inviteRedirectUrl\": \"$(cfg frontendUrl)\",
    \"sendInvitationMessage\": true
  }" --query invitedUser.id -o tsv)"
fi
echo "user: $email ($user_id)"

group="$(cfg usersGroup)"
if [ "$(az ad group member check --group "$group" --member-id "$user_id" --query value -o tsv)" != "true" ]; then
  az ad group member add --group "$group" --member-id "$user_id"
fi
echo "member of $group"

for app_id in "$(cfg webAppId)" "$(cfg apiAppId)"; do
  sp="$(az ad sp show --id "$app_id" --query id -o tsv)"
  assigned="$(az rest --method GET --uri "$graph/servicePrincipals/$sp/appRoleAssignedTo" \
    --query "value[?principalId=='$user_id'] | length(@)" -o tsv)"
  if [ "$assigned" = "0" ]; then
    az rest --method POST --uri "$graph/servicePrincipals/$sp/appRoleAssignedTo" --headers Content-Type=application/json \
      --body "{\"principalId\": \"$user_id\", \"resourceId\": \"$sp\", \"appRoleId\": \"$default_role\"}" -o none
  fi
done
echo "$email can now sign in to $(cfg clientName) at $(cfg frontendUrl)"
