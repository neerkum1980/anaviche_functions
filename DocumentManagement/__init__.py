import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.data.tables import TableServiceClient
import os
import json
import datetime
import logging


def main(req: func.HttpRequest) -> func.HttpResponse:
    method = req.method
    logging.info(f'DocumentManagement function processed a {method} request.')

    try:
        # Connection string
        conn_str = os.getenv("AzureWebJobsStorage")
        if not conn_str:
            return func.HttpResponse(
                json.dumps({"error": "AzureWebJobsStorage environment variable not set"}),
                status_code=500,
                mimetype="application/json",
                headers={"Access-Control-Allow-Origin": "*"}
            )

        # Initialize Azure clients
        blob_service = BlobServiceClient.from_connection_string(conn_str)
        table_service = TableServiceClient.from_connection_string(conn_str)

        container_name = "property-documents"
        container_client = blob_service.get_container_client(container_name)
        try:
            container_client.create_container()
        except Exception:
            pass  # container exists

        table_client = table_service.get_table_client("PropertyDocuments")
        try:
            table_service.create_table("PropertyDocuments")
        except Exception:
            pass  # table exists

        # -------------------- CORS Preflight --------------------
        if method == "OPTIONS":
            return func.HttpResponse(
                "OK",
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
                    "Access-Control-Allow-Headers": "*"
                }
            )

        # -------------------- POST: Upload Document --------------------
        if method == "POST":
            try:
                form = req.form
            except Exception:
                form = {}

            property_id = form.get('propertyId')
            if not property_id:
                return func.HttpResponse(
                    json.dumps({"error": "propertyId parameter required"}),
                    status_code=400,
                    mimetype="application/json",
                    headers={"Access-Control-Allow-Origin": "*"}
                )

            file = req.files.get('file')
            if not file:
                return func.HttpResponse(
                    json.dumps({"error": "No file provided"}),
                    status_code=400,
                    mimetype="application/json",
                    headers={"Access-Control-Allow-Origin": "*"}
                )

            filename = file.filename
            file_content = file.stream.read()
            file_size = len(file_content)
            timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
            blob_name = f"{property_id}/{timestamp}_{filename}"

            blob_client = container_client.get_blob_client(blob_name)
            blob_client.upload_blob(file_content, overwrite=True)

            entity = {
                "PartitionKey": property_id,
                "RowKey": timestamp,
                "BlobName": blob_name,
                "FileName": filename,
                "FileSize": file_size,
                "UploadedAt": datetime.datetime.utcnow().isoformat(),
                "ContentType": file.content_type or "application/octet-stream"
            }
            table_client.create_entity(entity=entity)

            return func.HttpResponse(
                json.dumps({
                    "message": "File uploaded successfully",
                    "blobName": blob_name,
                    "fileName": filename,
                    "fileSize": file_size,
                    "timestamp": timestamp
                }),
                status_code=200,
                mimetype="application/json",
                headers={"Access-Control-Allow-Origin": "*"}
            )

        # -------------------- GET: List or Download --------------------
        elif method == "GET":
            property_id = req.params.get('propertyId')
            document_id = req.params.get('documentId')

            # Download a single document
            if property_id and document_id:
                try:
                    entity = table_client.get_entity(
                        partition_key=property_id,
                        row_key=document_id
                    )
                    blob_name = entity["BlobName"]
                    filename = entity["FileName"]
                    content_type = entity.get("ContentType", "application/octet-stream")
                    blob_client = container_client.get_blob_client(blob_name)
                    blob_data = blob_client.download_blob().readall()
                except Exception:
                    return func.HttpResponse(
                        json.dumps({"error": "Document not found"}),
                        status_code=404,
                        mimetype="application/json",
                        headers={"Access-Control-Allow-Origin": "*"}
                    )

                return func.HttpResponse(
                    blob_data,
                    headers={
                        "Content-Disposition": f'attachment; filename="{filename}"',
                        "Content-Type": content_type,
                        "Access-Control-Allow-Origin": "*"
                    }
                )

            # List all documents (filter by propertyId if provided)
            try:
                if property_id:
                    query = f"PartitionKey eq '{property_id}'"
                    entities = list(table_client.query_entities(query))
                else:
                    entities = list(table_client.list_entities())

                result = [
                    {
                        "PropertyId": e["PartitionKey"],
                        "DocumentId": e["RowKey"],
                        "FileName": e.get("FileName"),
                        "FileSize": e.get("FileSize"),
                        "BlobName": e.get("BlobName"),
                        "UploadedAt": e.get("UploadedAt"),
                        "ContentType": e.get("ContentType")
                    }
                    for e in entities
                ]

                return func.HttpResponse(
                    json.dumps(result),
                    status_code=200,
                    mimetype="application/json",
                    headers={"Access-Control-Allow-Origin": "*"}
                )

            except Exception as ex:
                logging.error(str(ex))
                return func.HttpResponse(
                    json.dumps({"error": f"Failed to list documents: {str(ex)}"}),
                    status_code=500,
                    mimetype="application/json",
                    headers={"Access-Control-Allow-Origin": "*"}
                )

        # -------------------- DELETE --------------------
        elif method == "DELETE":
            property_id = req.params.get('propertyId')
            document_id = req.params.get('documentId')

            if not property_id or not document_id:
                return func.HttpResponse(
                    json.dumps({"error": "propertyId and documentId required"}),
                    status_code=400,
                    mimetype="application/json",
                    headers={"Access-Control-Allow-Origin": "*"}
                )

            try:
                entity = table_client.get_entity(property_id, document_id)
                blob_name = entity["BlobName"]
                blob_client = container_client.get_blob_client(blob_name)
                blob_client.delete_blob()
                table_client.delete_entity(property_id, document_id)

                return func.HttpResponse(
                    json.dumps({"message": "Document deleted successfully"}),
                    status_code=200,
                    mimetype="application/json",
                    headers={"Access-Control-Allow-Origin": "*"}
                )

            except Exception:
                return func.HttpResponse(
                    json.dumps({"error": "Document not found"}),
                    status_code=404,
                    mimetype="application/json",
                    headers={"Access-Control-Allow-Origin": "*"}
                )

        else:
            return func.HttpResponse(
                json.dumps({"error": f"Method {method} not supported"}),
                status_code=405,
                mimetype="application/json",
                headers={"Access-Control-Allow-Origin": "*"}
            )

    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Failed: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
            headers={"Access-Control-Allow-Origin": "*"}
        )
