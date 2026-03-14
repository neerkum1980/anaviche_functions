import logging
import azure.functions as func
import uuid
import datetime
from azure.storage.blob import BlobServiceClient
from azure.data.tables import TableServiceClient
import os
import traceback

TABLE_NAME = "Expenses"
BLOB_CONTAINER = "bills"

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        conn_str = os.getenv("AzureWebJobsStorage")
        table_client = TableServiceClient.from_connection_string(conn_str).get_table_client(TABLE_NAME)
        blob_service = BlobServiceClient.from_connection_string(conn_str)

        property_id = req.form.get('propertyId')
        category = req.form.get('category')
        amount = req.form.get('amount')
        expense_date = req.form.get('expenseDate')
        description = req.form.get('description', '')

        if not property_id or not category or not amount or not expense_date:
            return func.HttpResponse(
                "Missing required field(s): propertyId, category, amount, expenseDate",
                status_code=400
            )

        # Convert amount and date
        amount = float(amount)
        expense_date = datetime.datetime.strptime(expense_date, "%Y-%m-%d").date()

        # Upload file if present
        document_id = None
        bill_file = req.files.get('bill')
        if bill_file:
            unique_blob_name = f"{uuid.uuid4()}_{bill_file.filename}"
            blob_client = blob_service.get_blob_client(container=BLOB_CONTAINER, blob=unique_blob_name)
            blob_client.upload_blob(bill_file.stream.read(), overwrite=True)
            document_id = unique_blob_name

        # Save to table
        row = {
            'PartitionKey': property_id,
            'RowKey': str(uuid.uuid4()),
            'Category': category,
            'Amount': amount,
            'ExpenseDate': expense_date.isoformat(),
            'Description': description,
            'DocumentId': document_id
        }

        table_client.create_entity(entity=row)

        return func.HttpResponse(
            f'{{"success": true, "expenseId": "{row["RowKey"]}", "documentId": "{document_id}"}}',
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logging.error(f"Error saving expense: {e}")
        logging.error(traceback.format_exc())
        return func.HttpResponse(f"❌ Failed: {str(e)}", status_code=500)
