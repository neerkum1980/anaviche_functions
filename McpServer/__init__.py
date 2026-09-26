"""Hosted MCP endpoint: the tools from mcp_server/server.py over streamable HTTP.

Clients connect to https://<host>/api/mcp with the x-functions-key header.
The server is stateless and answers with plain JSON, so every request stands on
its own and no session has to survive between Function invocations.
"""

import asyncio
import os

import azure.functions as func
from mcp.server.transport_security import TransportSecuritySettings

from mcp_server.server import build_server

MCP_PATH = "/api/mcp"


def _allowed_hosts() -> list[str]:
    # Keep DNS-rebinding protection on, but accept this app's own host name.
    hosts = ["localhost:*", "127.0.0.1:*"]
    site = os.getenv("WEBSITE_HOSTNAME")
    if site:
        hosts.append(site)
    return hosts


_app = build_server(hosted=True).streamable_http_app(
    streamable_http_path=MCP_PATH,
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(allowed_hosts=_allowed_hosts()),
)
_asgi = func.AsgiMiddleware(_app)
_started = False
_start_lock = asyncio.Lock()


async def main(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    global _started
    # The MCP session manager starts in the ASGI lifespan; run it once per worker.
    if not _started:
        async with _start_lock:
            if not _started:
                await _asgi.notify_startup()
                _started = True
    return await _asgi.handle_async(req, context)
