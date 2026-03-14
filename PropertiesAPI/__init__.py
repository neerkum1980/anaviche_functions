import azure.functions as func
from azure.data.tables import TableServiceClient
import os
import json
import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    method = req.method

    try:
        conn_str = os.getenv("AzureWebJobsStorage")
        table_service = TableServiceClient.from_connection_string(conn_str)
        table_client = table_service.get_table_client("Properties")

        # ----------------------------
        # CREATE (POST)
        # ----------------------------
        if method == "POST":
            req_body = req.get_json()
            name = req_body.get("Name", "Default Name")
            location = req_body.get("Location", "")
            units = req_body.get("Units", "")
            description = req_body.get("Description", "")

            entity = {
                "PartitionKey": "PropertiesPartition",
                "RowKey": datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S%f"),
                "Name": name,
                "Location": location,
                "Units": units,
                "Description": description
            }

            table_client.create_entity(entity=entity)
            return func.HttpResponse("✅ Successfully inserted record.", status_code=200)

        # ----------------------------
        # LIST (GET)
        # ----------------------------
        elif method == "GET":
            entities = list(table_client.list_entities())
            result = [
                {
                    "PartitionKey": e["PartitionKey"],
                    "RowKey": e["RowKey"],
                    "Name": e.get("Name"),
                    "Location": e.get("Location"),
                    "Units": e.get("Units"),
                    "Description": e.get("Description"),
                    "Timestamp": e.get("Timestamp")
                }
                for e in entities
            ]
            return func.HttpResponse(json.dumps(result), mimetype="application/json")

        # ----------------------------
        # UPDATE (PUT)
        # ----------------------------
        elif method == "PUT":
            req_body = req.get_json()
            partition = req_body.get("PartitionKey")
            rowkey = req_body.get("RowKey")

            if not partition or not rowkey:
                return func.HttpResponse("❌ PartitionKey and RowKey required for update", status_code=400)

            entity = table_client.get_entity(partition_key=partition, row_key=rowkey)

            entity["Name"] = req_body.get("Name", entity.get("Name"))
            entity["Location"] = req_body.get("Location", entity.get("Location"))
            entity["Units"] = req_body.get("Units", entity.get("Units"))
            entity["Description"] = req_body.get("Description", entity.get("Description"))

            table_client.update_entity(entity=entity, mode="Replace")
            return func.HttpResponse("✅ Successfully updated record.", status_code=200)

        # ----------------------------
        # DELETE (NEW)
        # ----------------------------
        elif method == "DELETE":
            rowkey = req.params.get("rowKey")
            if not rowkey:
                return func.HttpResponse("❌ RowKey required for delete", status_code=400)
            partition = "PropertiesPartition"
            try:
                table_client.delete_entity(partition_key=partition, row_key=rowkey)
                return func.HttpResponse("✅ Property deleted.", status_code=200)
            except Exception as e:
                return func.HttpResponse(f"❌ Delete failed: {str(e)}", status_code=500)

        else:
            return func.HttpResponse(f"❌ Method {method} not supported.", status_code=405)

    except Exception as e:
        return func.HttpResponse(f"❌ Failed: {e}", status_code=500)
