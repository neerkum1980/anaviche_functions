# Anaviche MCP server

An [MCP](https://modelcontextprotocol.io) server that exposes the backend functions in this repo as tools, so Claude (or any MCP client) can manage properties, expenses, bills and documents.

It calls the functions over HTTP rather than reading storage directly. As a result, the functions' own validation and audit logging still apply.

## Tools

| Tool | Function | Call |
|---|---|---|
| `list_properties` | PropertiesAPI | `GET /properties` |
| `create_property` | PropertiesAPI | `POST /properties` |
| `update_property` | PropertiesAPI | `PUT /properties` |
| `delete_property` | PropertiesAPI | `DELETE /properties?rowKey=` |
| `list_expenses` | ExpenseApi | `GET /expenses?propertyId=` |
| `add_expense` | ExpenseApi | `POST /expenses` (form, optional `bill` file) |
| `download_bill` | BillsDownloadApi | `GET /BillsDownloadApi?documentId=` |
| `list_documents` | DocumentManagement | `GET /DocumentManagement[?propertyId=]` |
| `upload_document` | DocumentManagement | `POST /DocumentManagement` (form, `file`) |
| `download_document` | DocumentManagement | `GET /DocumentManagement?propertyId=&documentId=` |
| `delete_document` | DocumentManagement | `DELETE /DocumentManagement?propertyId=&documentId=` |

The `gateway` function is a proxy, not a separate API. To route every call through it, set `ANAVICHE_BASE_URL` to `https://<host>/api/gateway`.

It runs in two modes:

- **Hosted**, inside the Function App as the `McpServer` function at `https://<app host>/api/mcp`. It deploys to test and production with the rest of the app. File tools take and return base64 content (5 MB max), because a path would refer to the Function App's own disk.
- **Local**, as a stdio process on your machine. File tools read local paths for uploads and save downloads to disk.

## Setup

```sh
python3.12 -m venv mcp_server/.venv
mcp_server/.venv/bin/pip install -r mcp_server/requirements.txt
```

This venv is only for running the server locally. The hosted version uses the Function App's own `requirements.txt`, which also lists `mcp` and `httpx`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ANAVICHE_BASE_URL` | `http://localhost:7071/api` | Functions base URL, including `/api` |
| `ANAVICHE_FUNCTION_KEY` | none | Function key, sent as `x-functions-key`. All APIs except `gateway` use `authLevel: function`. |
| `ANAVICHE_BEARER_TOKEN` | none | Entra ID access token, for when App Service authentication (`auth.json`) is on |
| `ANAVICHE_DOWNLOAD_DIR` | `~/Downloads/anaviche` | Where downloads are saved |
| `ANAVICHE_TIMEOUT` | `60` | Request timeout in seconds |

## Using the hosted server

Point any MCP client that supports streamable HTTP at the Function App, sending the app's function key:

```sh
claude mcp add --transport http anaviche-test https://anaviche-functions-test-y1.azurewebsites.net/api/mcp --header "x-functions-key: <test app function key>"
```

The endpoint is stateless and returns plain JSON. The function key protects it like the other APIs, and requests with a Host header other than the app's own are rejected (DNS-rebinding protection).

## Using it locally

**Claude Code:** the repo's `.mcp.json` registers the server as `anaviche`. Export the variables above in your shell, then start Claude Code from the repo root and approve the server when prompted.

**Other clients (such as Claude Desktop):** point them at the venv's Python with absolute paths:

```json
{
  "mcpServers": {
    "anaviche": {
      "command": "/path/to/anaviche-functions/mcp_server/.venv/bin/python",
      "args": ["/path/to/anaviche-functions/mcp_server/server.py"],
      "env": { "ANAVICHE_BASE_URL": "https://<app>.azurewebsites.net/api", "ANAVICHE_FUNCTION_KEY": "<key>" }
    }
  }
}
```

**Against a local backend:** run `func start` in the repo root. Note that `local.settings.json` points at the real storage accounts, so local runs change live data unless you switch it to `UseDevelopmentStorage=true` with Azurite.

## Adding a tool

When you add or change a function's route, methods or parameters, update the matching tool in `server.py`. Raise `ToolError` for failures the model should see, because other exceptions reach the client only as a generic "Error executing tool".
