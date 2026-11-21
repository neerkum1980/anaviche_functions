# Client stacks

Every client gets its own copy of the whole system in its own resource group, so no
data, storage, keys or sign-in setup is shared between clients. Code is the same for
all clients and is released to them by the **Release to clients** workflow.

## What one client has

| Piece | Name pattern | Notes |
|---|---|---|
| Resource group | `rg-anaviche-<client>` | Holds everything below, tagged `client=<client>` |
| Function App | `anaviche-<client>-<suffix>` | Flex Consumption, Python 3.12, all six functions |
| Data storage | `stanv<client>d<suffix>` | Tables, bills, documents, Functions host state |
| Audit storage | `stanv<client>a<suffix>` | `audit-logs` |
| Monitoring | `log-anaviche-<client>`, `appi-anaviche-<client>` | Log Analytics + Application Insights |
| Frontend | `swa-anaviche-<client>` | Static Web App (Free), West Europe |
| Users group | `anaviche-<client>-users` | The client's login users |
| Sign-in apps | `anaviche-<client>-api`, `anaviche-<client>-web` | Both require assignment: only the client's users can sign in |

`gateway`, the browser's way in, requires a token from the client's API app, so a user
of one client cannot call another client's backend. The APIs and the MCP endpoint
require the client's function key.

## Add a client

Signed in to Azure CLI as an admin who can create app registrations and assign roles:

```sh
infra/new-client.sh <client> "<Client Name>"      # e.g. infra/new-client.sh acme "Acme AG"
infra/add-user.sh <client> person@example.com     # once per login user
```

Commit the new `clients/<client>.json`, push, then run **Release to clients** with
`client` set to the new id. The first release deploys the code, creates the gateway key
and publishes the frontend.

`new-client.sh` and `add-user.sh` are safe to re-run. People who are not in the
directory yet get a guest invitation by email.

## Move an existing client's data

`copy-data.py` copies tables and blobs from one client's storage to another and never
modifies the source:

```sh
export SOURCE_DATA=... SOURCE_AUDIT=... DEST_DATA=... DEST_AUDIT=...   # connection strings
.venv/bin/python infra/copy-data.py
```

## Release

Actions → **Release to clients** → Run workflow, with `client` set to `all` or one id.
Each client is deployed and smoke-tested on its own; one failing does not stop the rest.
Every push to `main` still lands on the shared test app first (**Deploy Functions**).
