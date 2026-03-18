import logging
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('BillsDownloadApi triggered')

    blob_path = req.params.get('blob') or req.params.get('documentId')
    property_id = req.params.get('propertyId')
    if not blob_path:
        return func.HttpResponse("Missing 'blob' or 'documentId' parameter", status_code=400)

    try:
        connect_str = os.getenv("AzureWebJobsStorage") or os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        if not connect_str:
            logging.error("Missing connection string")
            return func.HttpResponse("Missing storage connection string", status_code=500)

        blob_service_client = BlobServiceClient.from_connection_string(connect_str)
        container_name = "bills"
        container_client = blob_service_client.get_container_client(container_name)

        resolved_blob_path = None
        candidates = [blob_path]
        if property_id:
            candidates.append(f"{property_id}/{blob_path}")

        for candidate in candidates:
            try:
                blob_client = container_client.get_blob_client(candidate)
                if blob_client.exists():
                    resolved_blob_path = candidate
                    break
            except Exception as e:
                logging.error(f"Blob exists check failed for {candidate}: {e}")

        if not resolved_blob_path:
            try:
                for blob in container_client.list_blobs():
                    name = blob.name
                    if name == blob_path or name.endswith(f"_{blob_path}") or name.endswith(f"/{blob_path}"):
                        resolved_blob_path = name
                        break
            except Exception as e:
                logging.error(f"Blob search failed: {e}")

        if not resolved_blob_path:
            return func.HttpResponse("Blob not found or cannot be downloaded", status_code=404)

        blob_client = container_client.get_blob_client(resolved_blob_path)

        logging.info(f"Trying to download blob: container={container_name}, blob={resolved_blob_path}")

        # Try downloading the blob
        try:
            data = blob_client.download_blob().readall()
        except ResourceNotFoundError:
            return func.HttpResponse("Blob not found or cannot be downloaded", status_code=404)
        except Exception as e:
            logging.error(f"Blob download failed: {e}")
            return func.HttpResponse(f"Error downloading blob: {e}", status_code=500)

        # Determine content type
        content_type = "application/octet-stream"
        if blob_path.endswith(".html"):
            content_type = "text/html"

        return func.HttpResponse(
            body=data,
            mimetype=content_type,
            status_code=200,
            headers={"Content-Disposition": f"attachment; filename={os.path.basename(resolved_blob_path)}"}
        )

    except Exception as e:
        logging.error(f"Unhandled error: {e}")
        return func.HttpResponse(f"Error downloading blob: {e}", status_code=500)
