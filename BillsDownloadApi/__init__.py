import logging
import azure.functions as func
from azure.storage.blob import BlobServiceClient
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('BillsDownloadApi triggered')

    blob_path = req.params.get('blob')
    if not blob_path:
        return func.HttpResponse("Missing 'blob' parameter", status_code=400)

    try:
        connect_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        if not connect_str:
            logging.error("Missing connection string")
            return func.HttpResponse("Missing storage connection string", status_code=500)

        blob_service_client = BlobServiceClient.from_connection_string(connect_str)
        container_name = "bills"
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_path)

        logging.info(f"Trying to download blob: container={container_name}, blob={blob_path}")

        # Try downloading the blob
        try:
            data = blob_client.download_blob().readall()
        except Exception as e:
            logging.error(f"Blob download failed: {e}")
            return func.HttpResponse("Blob not found or cannot be downloaded", status_code=404)

        # Determine content type
        content_type = "application/octet-stream"
        if blob_path.endswith(".html"):
            content_type = "text/html"

        return func.HttpResponse(
            body=data,
            mimetype=content_type,
            status_code=200,
            headers={"Content-Disposition": f"attachment; filename={os.path.basename(blob_path)}"}
        )

    except Exception as e:
        logging.error(f"Unhandled error: {e}")
        return func.HttpResponse(f"Error downloading blob: {e}", status_code=500)
