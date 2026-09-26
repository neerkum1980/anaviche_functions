"""MCP server exposing the anaviche-functions HTTP APIs as tools.

Every tool calls the Azure Functions over HTTP rather than touching storage
directly, so validation and audit logging in the functions still apply.

It runs in two modes, built by build_server():
    local   stdio, started by an MCP client on your machine (python server.py).
            File tools read and write local paths.
    hosted  streamable HTTP inside the Function App (the McpServer function).
            File tools take and return base64 content, because paths would refer
            to the Function App's own disk.

Configuration (environment variables):
    ANAVICHE_BASE_URL      Base URL of the functions API, including /api.
                           Default: the Function App's own host when hosted,
                           otherwise http://localhost:7071/api.
                           To route through the gateway function, use
                           https://<host>/api/gateway
    ANAVICHE_FUNCTION_KEY  Function key, sent as x-functions-key. When hosted,
                           falls back to the app's FUNCTIONS_KEY setting.
    ANAVICHE_BEARER_TOKEN  Entra ID access token, sent as Authorization: Bearer,
                           for when App Service authentication is enabled (auth.json).
    ANAVICHE_DOWNLOAD_DIR  Local mode: where downloaded files are saved.
                           Default: ~/Downloads/anaviche
    ANAVICHE_TIMEOUT       Request timeout in seconds. Default: 60
"""

import base64
import binascii
import datetime
import mimetypes
import os
import re
import urllib.parse
from pathlib import Path
from typing import Any, Literal

import httpx
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations

BEARER_TOKEN = os.getenv("ANAVICHE_BEARER_TOKEN")
DOWNLOAD_DIR = Path(os.getenv("ANAVICHE_DOWNLOAD_DIR", "~/Downloads/anaviche")).expanduser()
TIMEOUT = float(os.getenv("ANAVICHE_TIMEOUT", "60"))

PROPERTIES_PARTITION = "PropertiesPartition"
MAX_ERROR_BODY = 2000
MAX_INLINE_BYTES = 5 * 1024 * 1024  # hosted mode: largest file passed as base64

READ_ONLY = ToolAnnotations(read_only_hint=True, open_world_hint=True)
CREATES = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=True)
UPDATES = ToolAnnotations(read_only_hint=False, destructive_hint=True, idempotent_hint=True, open_world_hint=True)
DELETES = ToolAnnotations(read_only_hint=False, destructive_hint=True, idempotent_hint=True, open_world_hint=True)

INSTRUCTIONS = (
    "Tools for the Anaviche property-management backend. "
    "A property's id is its RowKey from list_properties. Expenses and documents "
    "are keyed by that same property id. An expense's DocumentId refers to a bill "
    "file that download_bill can fetch. Documents uploaded with upload_document "
    "are separate and are fetched with download_document."
)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _base_url() -> str:
    explicit = os.getenv("ANAVICHE_BASE_URL")
    if explicit:
        return explicit.rstrip("/")
    host = os.getenv("WEBSITE_HOSTNAME")  # set inside a Function App
    if host and not host.startswith(("localhost", "127.0.0.1")):
        return f"https://{host}/api"
    return f"http://{host}/api" if host else "http://localhost:7071/api"


def _function_key() -> str | None:
    return os.getenv("ANAVICHE_FUNCTION_KEY") or os.getenv("FUNCTIONS_KEY")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _headers() -> dict[str, str]:
    headers = {}
    key = _function_key()
    if key:
        headers["x-functions-key"] = key
    if BEARER_TOKEN:
        headers["Authorization"] = f"Bearer {BEARER_TOKEN}"
    return headers


async def _request(method: str, route: str, **kwargs: Any) -> httpx.Response:
    url = f"{_base_url()}/{route}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False) as client:
            response = await client.request(method, url, headers=_headers(), **kwargs)
    except httpx.HTTPError as e:
        raise ToolError(f"Could not reach {url}: {e}") from e

    if response.status_code in (301, 302, 401, 403):
        raise ToolError(
            f"{method} {route} was rejected with HTTP {response.status_code}. "
            "Check the function key, and the bearer token if App Service "
            "authentication is enabled."
        )
    if response.status_code >= 400:
        body = response.text[:MAX_ERROR_BODY]
        raise ToolError(f"{method} {route} failed with HTTP {response.status_code}: {body}")
    return response


def _body(response: httpx.Response) -> Any:
    if "application/json" in response.headers.get("content-type", ""):
        return response.json()
    return {"message": response.text}


def _filename_from_disposition(disposition: str | None) -> str | None:
    if not disposition:
        return None
    match = re.search(r"filename\*=UTF-8''([^;]+)", disposition, re.IGNORECASE)
    if match:
        return urllib.parse.unquote(match.group(1).strip())
    match = re.search(r'filename="?([^";]+)"?', disposition, re.IGNORECASE)
    return match.group(1).strip() if match else None


def _download_name(response: httpx.Response, fallback_name: str) -> str:
    name = _filename_from_disposition(response.headers.get("content-disposition")) or fallback_name
    return Path(name).name or "download"  # strip any directory components


def _save_download(response: httpx.Response, fallback_name: str, save_dir: str | None) -> dict[str, Any]:
    target_dir = Path(save_dir).expanduser() if save_dir else DOWNLOAD_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    name = _download_name(response, fallback_name)
    path = target_dir / name
    stem, suffix, n = path.stem, path.suffix, 1
    while path.exists():
        path = target_dir / f"{stem} ({n}){suffix}"
        n += 1

    path.write_bytes(response.content)
    return {
        "savedTo": str(path),
        "bytes": len(response.content),
        "contentType": response.headers.get("content-type"),
    }


def _inline_download(response: httpx.Response, fallback_name: str) -> dict[str, Any]:
    if len(response.content) > MAX_INLINE_BYTES:
        raise ToolError(
            f"File is {len(response.content)} bytes; the limit for returning a file "
            f"through MCP is {MAX_INLINE_BYTES} bytes. Download it from the API directly."
        )
    return {
        "fileName": _download_name(response, fallback_name),
        "contentType": response.headers.get("content-type"),
        "bytes": len(response.content),
        "contentBase64": base64.b64encode(response.content).decode("ascii"),
    }


def _read_local_file(file_path: str) -> tuple[str, bytes, str]:
    path = Path(file_path).expanduser()
    if not path.is_file():
        raise ToolError(f"File not found: {path}")
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return path.name, path.read_bytes(), content_type


def _decode_inline_file(file_name: str, content_base64: str) -> tuple[str, bytes, str]:
    name = Path(file_name).name
    if not name:
        raise ToolError("file_name must be a file name, such as receipt.pdf")
    try:
        data = base64.b64decode(content_base64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise ToolError("content_base64 is not valid base64") from e
    if len(data) > MAX_INLINE_BYTES:
        raise ToolError(f"File is {len(data)} bytes; the limit is {MAX_INLINE_BYTES} bytes.")
    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    return name, data, content_type


# ---------------------------------------------------------------------------
# Calls shared by both modes
# ---------------------------------------------------------------------------

async def _add_expense(
    property_id: str,
    category: str,
    amount: float,
    expense_date: str,
    description: str,
    transaction: str,
    bill: tuple[str, bytes, str] | None,
) -> dict[str, Any]:
    try:
        datetime.date.fromisoformat(expense_date)
    except ValueError as e:
        raise ToolError(f"expense_date must be YYYY-MM-DD, got {expense_date!r}") from e

    data = {
        "propertyId": property_id,
        "category": category,
        "amount": str(amount),
        "expenseDate": expense_date,
        "description": description,
        "transaction": transaction,
    }
    files = {"bill": bill} if bill else None
    return _body(await _request("POST", "expenses", data=data, files=files))


async def _get_bill(document_id: str, property_id: str | None) -> httpx.Response:
    params = {"documentId": document_id}
    if property_id:
        params["propertyId"] = property_id
    return await _request("GET", "BillsDownloadApi", params=params)


async def _upload_document(property_id: str, file: tuple[str, bytes, str]) -> dict[str, Any]:
    return _body(await _request("POST", "DocumentManagement", data={"propertyId": property_id}, files={"file": file}))


async def _get_document(property_id: str, document_id: str) -> httpx.Response:
    params = {"propertyId": property_id, "documentId": document_id}
    return await _request("GET", "DocumentManagement", params=params)


# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

def build_server(hosted: bool = False) -> MCPServer:
    """Build the MCP server. hosted=True swaps file-path tools for base64 ones."""
    mcp = MCPServer(name="anaviche", title="Anaviche property management", instructions=INSTRUCTIONS)

    # PropertiesAPI (route: properties)

    @mcp.tool(annotations=READ_ONLY)
    async def list_properties() -> list[dict[str, Any]]:
        """List all properties. Each property's RowKey is its property id."""
        return _body(await _request("GET", "properties"))

    @mcp.tool(annotations=CREATES)
    async def create_property(
        name: str,
        location: str = "",
        units: str = "",
        description: str = "",
    ) -> dict[str, Any]:
        """Create a property. The API does not return the new id; call list_properties to find it."""
        payload = {"Name": name, "Location": location, "Units": units, "Description": description}
        return _body(await _request("POST", "properties", json=payload))

    @mcp.tool(annotations=UPDATES)
    async def update_property(
        property_id: str,
        name: str | None = None,
        location: str | None = None,
        units: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Update a property's fields. Fields left unset keep their current value."""
        payload: dict[str, Any] = {"PartitionKey": PROPERTIES_PARTITION, "RowKey": property_id}
        for key, value in (("Name", name), ("Location", location), ("Units", units), ("Description", description)):
            if value is not None:
                payload[key] = value
        return _body(await _request("PUT", "properties", json=payload))

    @mcp.tool(annotations=DELETES)
    async def delete_property(property_id: str) -> dict[str, Any]:
        """Permanently delete a property. Its expenses and documents are not deleted."""
        return _body(await _request("DELETE", "properties", params={"rowKey": property_id}))

    # ExpenseApi (route: expenses)

    @mcp.tool(annotations=READ_ONLY)
    async def list_expenses(property_id: str) -> list[dict[str, Any]]:
        """List all expense and income records for a property."""
        return _body(await _request("GET", "expenses", params={"propertyId": property_id}))

    # DocumentManagement (route: DocumentManagement)

    @mcp.tool(annotations=READ_ONLY)
    async def list_documents(property_id: str | None = None) -> list[dict[str, Any]]:
        """List property documents, for one property or for all properties if property_id is omitted."""
        params = {"propertyId": property_id} if property_id else None
        return _body(await _request("GET", "DocumentManagement", params=params))

    @mcp.tool(annotations=DELETES)
    async def delete_document(property_id: str, document_id: str) -> dict[str, Any]:
        """Permanently delete a property document and its stored file."""
        params = {"propertyId": property_id, "documentId": document_id}
        return _body(await _request("DELETE", "DocumentManagement", params=params))

    if hosted:
        _register_inline_file_tools(mcp)
    else:
        _register_local_file_tools(mcp)
    return mcp


def _register_local_file_tools(mcp: MCPServer) -> None:
    @mcp.tool(annotations=CREATES)
    async def add_expense(
        property_id: str,
        category: str,
        amount: float,
        expense_date: str,
        description: str = "",
        transaction: Literal["informative", "debit", "credit"] = "informative",
        bill_file_path: str | None = None,
    ) -> dict[str, Any]:
        """Record an expense or income entry for a property.

        expense_date is YYYY-MM-DD. transaction is "debit" for money out, "credit" for
        money in, or "informative" for a record that does not affect the balance.
        bill_file_path optionally uploads a local receipt or bill file with the entry.
        """
        bill = _read_local_file(bill_file_path) if bill_file_path else None
        return await _add_expense(property_id, category, amount, expense_date, description, transaction, bill)

    @mcp.tool(annotations=READ_ONLY)
    async def download_bill(
        document_id: str,
        property_id: str | None = None,
        save_dir: str | None = None,
    ) -> dict[str, Any]:
        """Download the bill attached to an expense (its DocumentId) and save it locally.

        Saves to save_dir, or ANAVICHE_DOWNLOAD_DIR by default, and returns the saved path.
        """
        return _save_download(await _get_bill(document_id, property_id), document_id, save_dir)

    @mcp.tool(annotations=CREATES)
    async def upload_document(property_id: str, file_path: str) -> dict[str, Any]:
        """Upload a local file as a document for a property (lease, deed, insurance and so on)."""
        return await _upload_document(property_id, _read_local_file(file_path))

    @mcp.tool(annotations=READ_ONLY)
    async def download_document(
        property_id: str,
        document_id: str,
        save_dir: str | None = None,
    ) -> dict[str, Any]:
        """Download a property document and save it locally.

        Saves to save_dir, or ANAVICHE_DOWNLOAD_DIR by default, and returns the saved path.
        """
        return _save_download(await _get_document(property_id, document_id), document_id, save_dir)


def _register_inline_file_tools(mcp: MCPServer) -> None:
    @mcp.tool(annotations=CREATES)
    async def add_expense(
        property_id: str,
        category: str,
        amount: float,
        expense_date: str,
        description: str = "",
        transaction: Literal["informative", "debit", "credit"] = "informative",
        bill_file_name: str | None = None,
        bill_content_base64: str | None = None,
    ) -> dict[str, Any]:
        """Record an expense or income entry for a property.

        expense_date is YYYY-MM-DD. transaction is "debit" for money out, "credit" for
        money in, or "informative" for a record that does not affect the balance.
        To attach a bill (5 MB max), pass bill_file_name and bill_content_base64 together.
        """
        if bool(bill_file_name) != bool(bill_content_base64):
            raise ToolError("Pass bill_file_name and bill_content_base64 together, or neither.")
        bill = _decode_inline_file(bill_file_name, bill_content_base64) if bill_file_name else None
        return await _add_expense(property_id, category, amount, expense_date, description, transaction, bill)

    @mcp.tool(annotations=READ_ONLY)
    async def download_bill(document_id: str, property_id: str | None = None) -> dict[str, Any]:
        """Fetch the bill attached to an expense (its DocumentId) as base64 (5 MB max)."""
        return _inline_download(await _get_bill(document_id, property_id), document_id)

    @mcp.tool(annotations=CREATES)
    async def upload_document(property_id: str, file_name: str, content_base64: str) -> dict[str, Any]:
        """Upload a document for a property (lease, deed, insurance and so on), 5 MB max, as base64."""
        return await _upload_document(property_id, _decode_inline_file(file_name, content_base64))

    @mcp.tool(annotations=READ_ONLY)
    async def download_document(property_id: str, document_id: str) -> dict[str, Any]:
        """Fetch a property document as base64 (5 MB max)."""
        return _inline_download(await _get_document(property_id, document_id), document_id)


def main() -> None:
    build_server(hosted=False).run()


if __name__ == "__main__":
    main()
