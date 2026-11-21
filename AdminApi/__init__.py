"""Platform admin API: lists clients and accepts onboarding requests.

Active only in the master client's stack (ANAVICHE_ADMIN_ENABLED=true), behind App
Service authentication, and only for users whose token carries the Platform.Admin role.

This function never provisions anything itself. A request becomes a row with status
"requested" in the Clients registry table; the "Provision clients" GitHub workflow picks
it up, creates the stack with its own identity and updates the row.

    GET  /api/admin/clients            all clients
    GET  /api/admin/clients/{client}   one client
    POST /api/admin/clients            {"client", "clientName", "adminEmail"}
"""

import base64
import datetime
import json
import logging
import os
import re

import azure.functions as func
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from azure.data.tables import TableServiceClient

TABLE_NAME = "Clients"
PARTITION = "client"
ADMIN_ROLE = "Platform.Admin"
CLIENT_ID = re.compile(r"^[a-z0-9]{3,12}$")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ROLE_CLAIMS = {"roles", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"}
NAME_CLAIMS = ("preferred_username", "name", "email")


def _json(body, status_code=200):
    return func.HttpResponse(json.dumps(body), status_code=status_code, mimetype="application/json")


def _error(message, status_code):
    return _json({"error": message}, status_code)


def _admin_enabled():
    # App Service authentication strips any x-ms-client-principal header a caller sends
    # and sets WEBSITE_AUTH_ENABLED; without it the header could be forged.
    return (
        os.getenv("ANAVICHE_ADMIN_ENABLED", "").lower() == "true"
        and os.getenv("WEBSITE_AUTH_ENABLED", "").lower() == "true"
    )


def _principal(req):
    header = req.headers.get("x-ms-client-principal")
    if not header:
        return None
    try:
        data = json.loads(base64.b64decode(header))
    except (ValueError, TypeError):
        return None
    claims = data.get("claims") or []
    role_claims = ROLE_CLAIMS | {data.get("role_typ")}
    roles = {c.get("val") for c in claims if c.get("typ") in role_claims}
    name = next((c.get("val") for typ in NAME_CLAIMS for c in claims if c.get("typ") == typ), "unknown")
    return {"name": name, "roles": roles}


def _table():
    conn_str = os.getenv("AzureWebJobsStorage")
    service = TableServiceClient.from_connection_string(conn_str)
    try:
        service.create_table(TABLE_NAME)
    except ResourceExistsError:
        pass
    return service.get_table_client(TABLE_NAME)


def _public(entity):
    row = {k: v for k, v in entity.items() if k not in ("PartitionKey", "RowKey")}
    row["client"] = entity["RowKey"]
    return row


def _list(table):
    rows = [_public(e) for e in table.query_entities(f"PartitionKey eq '{PARTITION}'")]
    return _json(sorted(rows, key=lambda r: r.get("requestedAt") or ""))


def _get(table, client):
    try:
        return _json(_public(table.get_entity(PARTITION, client)))
    except ResourceNotFoundError:
        return _error(f"No client {client!r}.", 404)


def _request(table, req, principal):
    try:
        body = req.get_json()
    except ValueError:
        return _error("Send a JSON body with client, clientName and adminEmail.", 400)

    client = str(body.get("client", "")).strip()
    client_name = str(body.get("clientName", "")).strip()
    admin_email = str(body.get("adminEmail", "")).strip()
    if not CLIENT_ID.match(client):
        return _error("client must be 3-12 lowercase letters or digits.", 400)
    if not client_name or len(client_name) > 80:
        return _error("clientName is required (80 characters at most).", 400)
    if not EMAIL.match(admin_email):
        return _error("adminEmail must be an email address.", 400)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    entity = {
        "PartitionKey": PARTITION,
        "RowKey": client,
        "clientName": client_name,
        "adminEmail": admin_email,
        "status": "requested",
        "requestedBy": principal["name"],
        "requestedAt": now,
        "updatedAt": now,
        "master": False,
    }
    try:
        table.create_entity(entity)
    except ResourceExistsError:
        existing = table.get_entity(PARTITION, client)
        if existing.get("status") != "failed":
            return _error(f"Client {client!r} already exists.", 409)
        # A failed attempt can be requested again; provisioning is safe to re-run.
        table.upsert_entity(entity)
    logging.info("Client %s requested by %s", client, principal["name"])
    return _json(_public(entity), 202)


def main(req: func.HttpRequest) -> func.HttpResponse:
    if not _admin_enabled():
        return _error("Not found.", 404)
    principal = _principal(req)
    if not principal:
        return _error("Sign in to continue.", 401)
    if ADMIN_ROLE not in principal["roles"]:
        return _error("This needs the Platform.Admin role.", 403)

    path = (req.route_params.get("path") or "").strip("/")
    method = req.method.upper()
    try:
        table = _table()
        if path == "clients" and method == "GET":
            return _list(table)
        if path == "clients" and method == "POST":
            return _request(table, req, principal)
        if path.startswith("clients/") and method == "GET":
            return _get(table, path.split("/", 1)[1])
        return _error("Not found.", 404)
    except Exception as e:
        logging.error(f"AdminApi error: {e}")
        return _error("The client registry could not be read or written.", 500)
