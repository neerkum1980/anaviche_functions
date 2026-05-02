import json
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from azure.core.exceptions import HttpResponseError
from azure.data.tables import TableServiceClient
from azure.storage.blob import BlobServiceClient

TABLE_NAME = "Expenses"
AUDIT_CONTAINER = "audit-logs"


def _load_local_settings() -> dict:
    settings_path = Path(__file__).resolve().parents[1] / "local.settings.json"
    if not settings_path.exists():
        return {}
    with settings_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data.get("Values", {})


def main() -> None:
    settings = _load_local_settings()
    source_conn = os.getenv("AzureWebJobsStorage") or settings.get("AzureWebJobsStorage")
    audit_conn = os.getenv("AUDIT_STORAGE_CONNECTION_STRING") or settings.get("AUDIT_STORAGE_CONNECTION_STRING")

    if not source_conn:
        raise SystemExit("Missing AzureWebJobsStorage")
    if not audit_conn:
        raise SystemExit("Missing AUDIT_STORAGE_CONNECTION_STRING")

    table_service = TableServiceClient.from_connection_string(source_conn)
    table_client = table_service.get_table_client(TABLE_NAME)

    blob_service = BlobServiceClient.from_connection_string(audit_conn)
    container_client = blob_service.get_container_client(AUDIT_CONTAINER)
    try:
        container_client.create_container()
    except Exception:
        pass

    query = "Transaction eq 'debit' or Transaction eq 'credit'"
    entities = table_client.query_entities(query)

    count = 0
    for entity in entities:
        property_id = entity.get("PartitionKey")
        row_key = entity.get("RowKey")
        if not property_id or not row_key:
            continue

        audit_payload = {
            "PartitionKey": property_id,
            "RowKey": row_key,
            "Category": entity.get("Category"),
            "Amount": entity.get("Amount"),
            "ExpenseDate": entity.get("ExpenseDate"),
            "Description": entity.get("Description"),
            "DocumentId": entity.get("DocumentId"),
            "Transaction": entity.get("Transaction"),
            "Source": "ExpenseApi",
            "CreatedAt": datetime.utcnow().isoformat()
        }

        safe_property_id = quote(str(property_id), safe="")
        safe_row_key = quote(str(row_key), safe="")
        blob_name = f"{safe_property_id}/{safe_row_key}.json"
        blob_client = container_client.get_blob_client(blob_name)
        try:
            blob_client.upload_blob(json.dumps(audit_payload).encode("utf-8"), overwrite=True)
            count += 1
        except HttpResponseError as exc:
            print(f"Failed to write {blob_name}: {exc.message}")

    print(f"Backfill complete. Wrote {count} audit blobs.")


if __name__ == "__main__":
    main()
