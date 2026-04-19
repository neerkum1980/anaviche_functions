import logging
import azure.functions as func
import uuid
import datetime
from azure.storage.blob import BlobServiceClient
from azure.data.tables import TableServiceClient
import os
import traceback
import json

TABLE_NAME = "Expenses"
BLOB_CONTAINER = "bills"
TRANSACTION_TABLE_NAME = "Transactions"
TRANSACTION_STORAGE_CONN_ENV = "ANAVICHEAG_STORAGE_CONNECTION_STRING"

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        conn_str = os.getenv("AzureWebJobsStorage")
        if not conn_str:
            return func.HttpResponse("Missing storage connection string", status_code=500)

        transaction_conn_str = os.getenv(TRANSACTION_STORAGE_CONN_ENV)

        table_service = TableServiceClient.from_connection_string(conn_str)
        table_client = table_service.get_table_client(TABLE_NAME)
        try:
            table_service.create_table(TABLE_NAME)
        except Exception:
            pass
        blob_service = BlobServiceClient.from_connection_string(conn_str)

        method = req.method.upper()

        if method == "GET":
            property_id = req.params.get('propertyId')
            if not property_id:
                return func.HttpResponse("Missing required field: propertyId", status_code=400)

            query = f"PartitionKey eq '{property_id}'"
            entities = list(table_client.query_entities(query))
            result = [
                {
                    "PartitionKey": e.get("PartitionKey"),
                    "RowKey": e.get("RowKey"),
                    "Category": e.get("Category"),
                    "Amount": e.get("Amount"),
                    "ExpenseDate": e.get("ExpenseDate"),
                    "Description": e.get("Description"),
                    "DocumentId": e.get("DocumentId"),
                    "Transaction": e.get("Transaction", "informative")
                }
                for e in entities
            ]

            return func.HttpResponse(json.dumps(result), mimetype="application/json", status_code=200)

        property_id = req.form.get('propertyId')
        category = req.form.get('category')
        amount = req.form.get('amount')
        expense_date = req.form.get('expenseDate')
        description = req.form.get('description', '')
        transaction_type = (req.form.get('transaction') or 'informative').strip().lower()
        if transaction_type not in {"informative", "debit", "credit"}:
            return func.HttpResponse(
                "Invalid transaction type. Use informative, debit, or credit.",
                status_code=400
            )

        if not property_id or not category or not amount or not expense_date:
            return func.HttpResponse(
                "Missing required field(s): propertyId, category, amount, expenseDate",
                status_code=400
            )

        amount = float(amount)
        expense_date = datetime.datetime.strptime(expense_date, "%Y-%m-%d").date()

        document_id = None
        bill_file = req.files.get('bill')
        if bill_file:
            unique_blob_name = f"{uuid.uuid4()}_{bill_file.filename}"
            blob_client = blob_service.get_blob_client(container=BLOB_CONTAINER, blob=unique_blob_name)
            blob_client.upload_blob(bill_file.stream.read(), overwrite=True)
            document_id = unique_blob_name

        row = {
            'PartitionKey': property_id,
            'RowKey': str(uuid.uuid4()),
            'Category': category,
            'Amount': amount,
            'ExpenseDate': expense_date.isoformat(),
            'Description': description,
            'DocumentId': document_id,
            'Transaction': transaction_type
        }

        table_client.create_entity(entity=row)

        if transaction_conn_str:
            transaction_table_service = TableServiceClient.from_connection_string(transaction_conn_str)
            transaction_table_client = transaction_table_service.get_table_client(TRANSACTION_TABLE_NAME)
            try:
                transaction_table_service.create_table(TRANSACTION_TABLE_NAME)
            except Exception:
                pass

            transaction_row = {
                "PartitionKey": property_id,
                "RowKey": row["RowKey"],
                "Category": category,
                "Amount": amount,
                "ExpenseDate": expense_date.isoformat(),
                "Description": description,
                "DocumentId": document_id,
                "Transaction": transaction_type,
                "Source": "ExpenseApi",
                "CreatedAt": datetime.datetime.utcnow().isoformat()
            }
            transaction_table_client.create_entity(entity=transaction_row)

            audit_blob_service = BlobServiceClient.from_connection_string(transaction_conn_str)
            audit_container_client = audit_blob_service.get_container_client("audit_logs")
            try:
                audit_container_client.create_container()
            except Exception:
                pass

            audit_blob_name = f"{property_id}/{row['RowKey']}.json"
            audit_blob_client = audit_container_client.get_blob_client(audit_blob_name)
            audit_blob_client.upload_blob(
                json.dumps(transaction_row).encode("utf-8"),
                overwrite=True
            )

        return func.HttpResponse(
            json.dumps({"success": True, "expenseId": row["RowKey"], "documentId": document_id}),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logging.error(f"Error saving expense: {e}")
        logging.error(traceback.format_exc())
        return func.HttpResponse(f"❌ Failed: {str(e)}", status_code=500)
