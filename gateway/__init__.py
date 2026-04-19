import logging
import os
import urllib.parse
import urllib.request
import urllib.error
import azure.functions as func


def _build_target_url(req: func.HttpRequest, path: str) -> str:
    host = os.getenv("WEBSITE_HOSTNAME")
    base = f"https://{host}" if host else "http://localhost:7071"

    query_params = dict(req.params)
    function_key = query_params.get("code") or req.headers.get("x-functions-key") or os.getenv("FUNCTIONS_KEY")
    if function_key and "code" not in query_params:
        query_params["code"] = function_key

    query_string = urllib.parse.urlencode(query_params, doseq=True)
    url = f"{base}/api/{path}"
    return f"{url}?{query_string}" if query_string else url


def main(req: func.HttpRequest) -> func.HttpResponse:
    path = (req.route_params.get("path") or "").lstrip("/")
    if not path or path.lower().startswith("gateway"):
        return func.HttpResponse("Invalid proxy target", status_code=400)

    target_url = _build_target_url(req, path)
    logging.info(f"Proxying {req.method} to {target_url}")

    body = req.get_body() or None
    headers = {
        k: v for k, v in req.headers.items()
        if k.lower() not in {"host", "content-length"}
    }

    request = urllib.request.Request(
        target_url,
        data=body,
        headers=headers,
        method=req.method
    )

    try:
        with urllib.request.urlopen(request) as response:
            response_body = response.read()
            response_headers = {
                k: v for k, v in response.headers.items()
                if k.lower() not in {"transfer-encoding", "content-length", "connection", "server", "date"}
            }
            return func.HttpResponse(
                body=response_body,
                status_code=response.status,
                headers=response_headers
            )
    except urllib.error.HTTPError as e:
        response_body = e.read()
        response_headers = {
            k: v for k, v in e.headers.items()
            if k.lower() not in {"transfer-encoding", "content-length", "connection", "server", "date"}
        }
        return func.HttpResponse(
            body=response_body,
            status_code=e.code,
            headers=response_headers
        )
    except Exception as e:
        logging.error(f"Proxy error: {e}")
        return func.HttpResponse(f"Proxy error: {e}", status_code=502)
