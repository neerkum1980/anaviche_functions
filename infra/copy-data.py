"""Copy one client's data between storage accounts, for moving a client to a new stack.

Reads the source and writes the destination; the source is never modified. Safe to run
again: rows are upserted and blobs overwritten, so a second run just catches up on
anything added since the first.

Connection strings come from environment variables so keys stay off the command line:
    SOURCE_DATA, DEST_DATA     data accounts (tables, bills, property documents)
    SOURCE_AUDIT, DEST_AUDIT   audit accounts (audit-logs)

    python infra/copy-data.py
"""

import os
import sys

from azure.core.exceptions import ResourceExistsError
from azure.data.tables import TableServiceClient, UpdateMode
from azure.storage.blob import BlobServiceClient, ContentSettings

DATA_TABLES = ["Properties", "Expenses", "PropertyDocuments", "commercialproperties"]
DATA_CONTAINERS = ["bills", "property-documents"]
AUDIT_CONTAINERS = ["audit-logs"]


def env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        sys.exit(f"Set {name} to a storage connection string.")
    return value


def copy_tables(source: str, dest: str, tables: list[str]) -> None:
    src_service = TableServiceClient.from_connection_string(source)
    dst_service = TableServiceClient.from_connection_string(dest)
    existing = {t.name for t in src_service.list_tables()}
    for name in tables:
        if name not in existing:
            print(f"  table {name}: not in source, skipped")
            continue
        try:
            dst_service.create_table(name)
        except ResourceExistsError:
            pass
        src = src_service.get_table_client(name)
        dst = dst_service.get_table_client(name)
        count = 0
        for entity in src.list_entities():
            dst.upsert_entity(entity, mode=UpdateMode.REPLACE)
            count += 1
        print(f"  table {name}: {count} rows")


def copy_containers(source: str, dest: str, containers: list[str]) -> None:
    src_service = BlobServiceClient.from_connection_string(source)
    dst_service = BlobServiceClient.from_connection_string(dest)
    for name in containers:
        src = src_service.get_container_client(name)
        if not src.exists():
            print(f"  container {name}: not in source, skipped")
            continue
        dst = dst_service.get_container_client(name)
        if not dst.exists():
            dst.create_container()
        count = size = 0
        for blob in src.list_blobs():
            data = src.download_blob(blob.name).readall()
            settings = blob.content_settings
            dst.upload_blob(
                blob.name,
                data,
                overwrite=True,
                content_settings=ContentSettings(
                    content_type=settings.content_type,
                    content_disposition=settings.content_disposition,
                ),
            )
            count += 1
            size += len(data)
        print(f"  container {name}: {count} blobs, {size} bytes")


def main() -> None:
    print("Data account")
    copy_tables(env("SOURCE_DATA"), env("DEST_DATA"), DATA_TABLES)
    copy_containers(env("SOURCE_DATA"), env("DEST_DATA"), DATA_CONTAINERS)
    print("Audit account")
    copy_containers(env("SOURCE_AUDIT"), env("DEST_AUDIT"), AUDIT_CONTAINERS)


if __name__ == "__main__":
    main()
