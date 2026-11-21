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

## The master client and the admin

Neeraj Kumar (`neerajkumar`) is the **master client**: the platform owner. Its stack runs
the same code as every client, plus the platform admin (`AdminApi` and the Admin page),
switched on by `ANAVICHE_ADMIN_ENABLED=true`. Only users with the `Platform.Admin` role
on the master's API app can use it. `setup-master.sh` set this up once.

The **client registry** is the `Clients` table in the master's data storage (see
`platform.env`). It records every client, its status (`requested`, `provisioning`,
`ready`, `failed`) and the names the Release workflow needs.

## Add a client

On the master site, open **Admin**, fill in the client id, name and first user's email,
and select **Request client**. That only writes a `requested` row to the registry.

The **Provision clients** workflow checks the registry every 15 minutes (or right away:
Actions, Provision clients, Run workflow). For each request it runs, as the
`anaviche-provisioner` identity:

1. `new-client.sh <client> "<Client Name>"`: Entra users group and sign-in apps, resource
   group and stack, release access for the deploy identity, registry row set to `ready`.
2. `add-user.sh <client> <email>`: invites or adds the first user.
3. Starts **Release to clients** for the new client, which deploys the code and frontend.

The provisioner is the only identity that can create resources and Entra apps, and only
from the GitHub `provisioning` environment. Protect that environment (Settings,
Environments) with required reviewers and a main-only branch rule.

The scripts still work by hand for an admin signed in to Azure CLI:

```sh
infra/new-client.sh <client> "<Client Name>"
infra/add-user.sh <client> person@example.com     # also for more users later
```

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
